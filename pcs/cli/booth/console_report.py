from pcs.common import report_codes as codes
from pcs.cli.common.console_report import (
    format_file_role,
    format_optional,
    format_plural,
)
from pcs.common.tools import format_list

def format_booth_default(value, template):
    return "" if value in ("booth", "", None) else template.format(value)

def booth_config_accepted_by_node(info):
    desc = ""
    if info["name_list"] and info["name_list"] not in [["booth"]]:
        desc = "{_s} {_list}".format(
            _s=("s" if len(info["name_list"]) > 1 else ""),
            _list=format_list(info["name_list"])
        )
    return "{_node_info}Booth config{_desc} saved".format(
        _node_info=format_optional(info["node"], "{0}: "),
        _desc=desc,
    )

#Each value (a callable taking report_item.info) returns a message.
#Force text will be appended if necessary.
#If it is necessary to put the force text inside the string then the callable
#must take the force_text parameter.
CODE_TO_MESSAGE_BUILDER_MAP = {
    codes.BOOTH_LACK_OF_SITES: lambda info:
        "lack of sites for booth configuration (need 2 at least): sites {0}"
        .format(", ".join(info["sites"]) if info["sites"] else "missing")
    ,

    codes.BOOTH_EVEN_PEERS_NUM: lambda info:
        "odd number of peers is required (entered {number} peers)"
        .format(**info)
    ,

    codes.BOOTH_ADDRESS_DUPLICATION: lambda info:
        "duplicate address for booth configuration: {0}"
        .format(", ".join(info["addresses"]))
    ,

    codes.BOOTH_CONFIG_UNEXPECTED_LINES: lambda info:
        "unexpected {_line_pl} in booth config{_file_path}:\n{_line_list}"
        .format(
            _file_path=format_optional(info["file_path"], " '{0}'"),
            _line_pl=format_plural(info["line_list"], "line"),
            _line_list="\n".join(info["line_list"]),
            **info
        )
    ,

    codes.BOOTH_INVALID_NAME: lambda info:
        "booth name '{name}' is not valid ({reason})"
        .format(**info)
    ,

    codes.BOOTH_TICKET_NAME_INVALID: lambda info:
        "booth ticket name '{0}' is not valid, use alphanumeric chars or dash"
        .format(info["ticket_name"])
    ,

    codes.BOOTH_TICKET_DUPLICATE: lambda info:
        "booth ticket name '{ticket_name}' already exists in configuration"
        .format(**info)
    ,

    codes.BOOTH_TICKET_DOES_NOT_EXIST: lambda info:
        "booth ticket name '{ticket_name}' does not exist"
        .format(**info)
    ,

    codes.BOOTH_ALREADY_IN_CIB: lambda info:
        "booth instance '{name}' is already created as cluster resource"
        .format(**info)
    ,

    codes.BOOTH_NOT_EXISTS_IN_CIB: lambda info:
        "booth instance '{name}' not found in cib"
        .format(**info)
    ,

    codes.BOOTH_CONFIG_IS_USED: lambda info:
        "booth instance '{0}' is used{1}".format(
            info["name"],
            " {0}".format(info["detail"]) if info["detail"] else "",
        )
    ,

    codes.BOOTH_MULTIPLE_TIMES_IN_CIB: lambda info:
        "found more than one booth instance '{name}' in cib"
        .format(**info)
    ,

    codes.BOOTH_CONFIG_DISTRIBUTION_STARTED: lambda info:
        "Sending booth configuration to cluster nodes..."
    ,

    codes.BOOTH_CONFIG_ACCEPTED_BY_NODE: booth_config_accepted_by_node,

    codes.BOOTH_CONFIG_DISTRIBUTION_NODE_ERROR: lambda info:
        "Unable to save booth config{_desc} on node '{node}': {reason}".format(
            _desc=format_booth_default(info["name"], " '{0}'"),
            **info
        )
    ,

    codes.BOOTH_FETCHING_CONFIG_FROM_NODE: lambda info:
        "Fetching booth config{desc} from node '{node}'...".format(
            desc=format_booth_default(info["config"], " '{0}'"),
            **info
        )
    ,

    codes.BOOTH_DAEMON_STATUS_ERROR: lambda info:
        "unable to get status of booth daemon: {reason}".format(**info)
    ,

    codes.BOOTH_TICKET_STATUS_ERROR: "unable to get status of booth tickets",

    codes.BOOTH_PEERS_STATUS_ERROR: "unable to get status of booth peers",

    codes.BOOTH_CANNOT_DETERMINE_LOCAL_SITE_IP: lambda info:
        "cannot determine local site ip, please specify site parameter"
    ,

    codes.BOOTH_TICKET_OPERATION_FAILED: lambda info:
        (
            "unable to {operation} booth ticket '{ticket_name}'"
            " for site '{site_ip}', reason: {reason}"
        ).format(**info)

    ,

    codes.BOOTH_UNSUPPORTED_FILE_LOCATION: lambda info:
        (
            "{_file_role} '{file_path}' is outside of supported booth config "
            "directory '{expected_dir}', ignoring the file"
        ).format(
            _file_role=format_file_role(info["file_type_code"]),
            **info
        )
    ,
}
