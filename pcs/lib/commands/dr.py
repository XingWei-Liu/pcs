from typing import (
    Any,
    Container,
    Iterable,
    List,
    Mapping,
    Tuple,
)

from pcs.common import file_type_codes, report_codes
from pcs.common.dr import (
    DrConfigDto,
    DrConfigNodeDto,
    DrConfigSiteDto,
    DrSiteStatusDto,
)
from pcs.common.file import RawFileError
from pcs.common.node_communicator import RequestTarget
from pcs.common.reports import SimpleReportProcessor

from pcs.lib import node_communication_format, reports
from pcs.lib.communication.corosync import GetCorosyncConf
from pcs.lib.communication.nodes import (
    DistributeFilesWithoutForces,
    RemoveFilesWithoutForces,
)
from pcs.lib.communication.status import GetFullClusterStatusPlaintext
from pcs.lib.communication.tools import (
    run as run_com_cmd,
    run_and_raise,
)
from pcs.lib.corosync.config_facade import ConfigFacade as CorosyncConfigFacade
from pcs.lib.dr.config.facade import (
    DrRole,
    Facade as DrConfigFacade,
)
from pcs.lib.env import LibraryEnvironment
from pcs.lib.errors import LibraryError, ReportItemList
from pcs.lib.file.instance import FileInstance
from pcs.lib.file.raw_file import raw_file_error_report
from pcs.lib.file.toolbox import for_file_type as get_file_toolbox
from pcs.lib.interface.config import ParserErrorException
from pcs.lib.node import get_existing_nodes_names


def get_config(env: LibraryEnvironment) -> Mapping[str, Any]:
    """
    Return local disaster recovery config

    env -- LibraryEnvironment
    """
    report_processor = SimpleReportProcessor(env.report_processor)
    report_list, dr_config = _load_dr_config(env.get_dr_env().config)
    report_processor.report_list(report_list)
    if report_processor.has_errors:
        raise LibraryError()

    return DrConfigDto(
        DrConfigSiteDto(
            dr_config.local_role,
            []
        ),
        [
            DrConfigSiteDto(
                site.role,
                [DrConfigNodeDto(name) for name in site.node_name_list]
            )
            for site in dr_config.get_remote_site_list()
        ]
    ).to_dict()


def set_recovery_site(env: LibraryEnvironment, node_name: str) -> None:
    """
    Set up disaster recovery with the local cluster being the primary site

    env
    node_name -- a known host from the recovery site
    """
    if env.ghost_file_codes:
        raise LibraryError(
            reports.live_environment_required(env.ghost_file_codes)
        )
    report_processor = SimpleReportProcessor(env.report_processor)
    dr_env = env.get_dr_env()
    if dr_env.config.raw_file.exists():
        report_processor.report(reports.dr_config_already_exist())
    target_factory = env.get_node_target_factory()

    local_nodes, report_list = get_existing_nodes_names(
        env.get_corosync_conf(),
        error_on_missing_name=True
    )
    report_processor.report_list(report_list)

    if node_name in local_nodes:
        report_processor.report(reports.node_in_local_cluster(node_name))

    report_list, local_targets = target_factory.get_target_list_with_reports(
        local_nodes, allow_skip=False, report_none_host_found=False
    )
    report_processor.report_list(report_list)

    report_list, remote_targets = (
        target_factory.get_target_list_with_reports(
            [node_name], allow_skip=False, report_none_host_found=False
        )
    )
    report_processor.report_list(report_list)

    if report_processor.has_errors:
        raise LibraryError()

    com_cmd = GetCorosyncConf(env.report_processor)
    com_cmd.set_targets(remote_targets)
    remote_cluster_nodes, report_list = get_existing_nodes_names(
        CorosyncConfigFacade.from_string(
            run_and_raise(env.get_node_communicator(), com_cmd)
        ),
        error_on_missing_name=True
    )
    if report_processor.report_list(report_list):
        raise LibraryError()

    # ensure we have tokens for all nodes of remote cluster
    report_list, remote_targets = target_factory.get_target_list_with_reports(
        remote_cluster_nodes, allow_skip=False, report_none_host_found=False
    )
    if report_processor.report_list(report_list):
        raise LibraryError()
    dr_config_exporter = (
        get_file_toolbox(file_type_codes.PCS_DR_CONFIG).exporter
    )
    # create dr config for remote cluster
    remote_dr_cfg = dr_env.create_facade(DrRole.RECOVERY)
    remote_dr_cfg.add_site(DrRole.PRIMARY, local_nodes)
    # send config to all node of remote cluster
    distribute_file_cmd = DistributeFilesWithoutForces(
        env.report_processor,
        node_communication_format.pcs_dr_config_file(
            dr_config_exporter.export(remote_dr_cfg.config)
        )
    )
    distribute_file_cmd.set_targets(remote_targets)
    run_and_raise(env.get_node_communicator(), distribute_file_cmd)
    # create new dr config, with local cluster as primary site
    local_dr_cfg = dr_env.create_facade(DrRole.PRIMARY)
    local_dr_cfg.add_site(DrRole.RECOVERY, remote_cluster_nodes)
    distribute_file_cmd = DistributeFilesWithoutForces(
        env.report_processor,
        node_communication_format.pcs_dr_config_file(
            dr_config_exporter.export(local_dr_cfg.config)
        )
    )
    distribute_file_cmd.set_targets(local_targets)
    run_and_raise(env.get_node_communicator(), distribute_file_cmd)
    # Note: No token sync across multiple clusters. Most probably they are in
    # different subnetworks.


def status_all_sites_plaintext(
    env: LibraryEnvironment,
    hide_inactive_resources: bool = False,
    verbose: bool = False,
) -> List[Mapping[str, Any]]:
    """
    Return local site's and all remote sites' status as plaintext

    env -- LibraryEnvironment
    hide_inactive_resources -- if True, do not display non-running resources
    verbose -- if True, display more info
    """
    # The command does not provide an option to skip offline / unreacheable /
    # misbehaving nodes.
    # The point of such skipping is to stop a command if it is unable to make
    # changes on all nodes. The user can then decide to proceed anyway and
    # make changes on the skipped nodes later manually.
    # This command only reads from nodes so it automatically asks other nodes
    # if one is offline / misbehaving.
    class SiteData():
        local: bool
        role: DrRole
        target_list: Iterable[RequestTarget]
        status_loaded: bool
        status_plaintext: str

        def __init__(self, local, role, target_list):
            self.local = local
            self.role = role
            self.target_list = target_list
            self.status_loaded = False
            self.status_plaintext = ""


    if env.ghost_file_codes:
        raise LibraryError(
            reports.live_environment_required(env.ghost_file_codes)
        )

    report_processor = SimpleReportProcessor(env.report_processor)
    report_list, dr_config = _load_dr_config(env.get_dr_env().config)
    report_processor.report_list(report_list)
    if report_processor.has_errors:
        raise LibraryError()

    site_data_list = []
    target_factory = env.get_node_target_factory()

    # get local nodes
    local_nodes, report_list = get_existing_nodes_names(env.get_corosync_conf())
    report_processor.report_list(report_list)
    report_list, local_targets = target_factory.get_target_list_with_reports(
        local_nodes,
        skip_non_existing=True,
    )
    report_processor.report_list(report_list)
    site_data_list.append(SiteData(True, dr_config.local_role, local_targets))

    # get remote sites' nodes
    for conf_remote_site in dr_config.get_remote_site_list():
        report_list, remote_targets = (
            target_factory.get_target_list_with_reports(
                conf_remote_site.node_name_list,
                skip_non_existing=True,
            )
        )
        report_processor.report_list(report_list)
        site_data_list.append(
            SiteData(False, conf_remote_site.role, remote_targets)
        )
    if report_processor.has_errors:
        raise LibraryError()

    # get all statuses
    for site_data in site_data_list:
        com_cmd = GetFullClusterStatusPlaintext(
            report_processor,
            hide_inactive_resources=hide_inactive_resources,
            verbose=verbose,
        )
        com_cmd.set_targets(site_data.target_list)
        site_data.status_loaded, site_data.status_plaintext = run_com_cmd(
            env.get_node_communicator(), com_cmd
        )

    return [
        DrSiteStatusDto(
            site_data.local,
            site_data.role,
            site_data.status_plaintext,
            site_data.status_loaded,
        ).to_dict()
        for site_data in site_data_list
    ]

def _load_dr_config(
    config_file: FileInstance,
) -> Tuple[ReportItemList, DrConfigFacade]:
    if not config_file.raw_file.exists():
        return [reports.dr_config_does_not_exist()], DrConfigFacade.empty()
    try:
        return [], config_file.read_to_facade()
    except RawFileError as e:
        return [raw_file_error_report(e)], DrConfigFacade.empty()
    except ParserErrorException as e:
        return (
            config_file.parser_exception_to_report_list(e),
            DrConfigFacade.empty()
        )


def destroy(env: LibraryEnvironment, force_flags: Container[str] = ()) -> None:
    """
    Destroy disaster-recovery configuration on all sites
    """
    if env.ghost_file_codes:
        raise LibraryError(
            reports.live_environment_required(env.ghost_file_codes)
        )

    report_processor = SimpleReportProcessor(env.report_processor)
    skip_offline = report_codes.SKIP_OFFLINE_NODES in force_flags

    report_list, dr_config = _load_dr_config(env.get_dr_env().config)
    report_processor.report_list(report_list)

    if report_processor.has_errors:
        raise LibraryError()

    local_nodes, report_list = get_existing_nodes_names(env.get_corosync_conf())
    report_processor.report_list(report_list)

    if report_processor.has_errors:
        raise LibraryError()

    remote_nodes: List[str] = []
    for conf_remote_site in dr_config.get_remote_site_list():
        remote_nodes.extend(conf_remote_site.node_name_list)

    target_factory = env.get_node_target_factory()
    report_list, targets = target_factory.get_target_list_with_reports(
         remote_nodes + local_nodes, skip_non_existing=skip_offline,
    )
    report_processor.report_list(report_list)
    if report_processor.has_errors:
        raise LibraryError()

    com_cmd = RemoveFilesWithoutForces(
        env.report_processor, {
            "pcs disaster-recovery config": {
                "type": "pcs_disaster_recovery_conf",
            },
        },
    )
    com_cmd.set_targets(targets)
    run_and_raise(env.get_node_communicator(), com_cmd)
