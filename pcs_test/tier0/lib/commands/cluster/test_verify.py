from unittest import TestCase

from pcs_test.tools import fixture
from pcs_test.tools.command_env import get_env_tools

from pcs.common import report_codes
from pcs.lib.commands.cluster import verify


CRM_VERIFY_ERROR_REPORT_LINES = [
    "someting wrong\nsomething else wrong\n",
    "  Use -V -V for more detail\n",
]

BAD_FENCING_TOPOLOGY = """
    <fencing-topology>
        <fencing-level devices="FX" index="2" target="node1" id="fl-node1-2"/>
    </fencing-topology>
"""

BAD_FENCING_TOPOLOGY_REPORTS = [
    fixture.error(
        report_codes.STONITH_RESOURCES_DO_NOT_EXIST,
        stonith_ids=["FX"],
    ),
    fixture.error(
        report_codes.NODE_NOT_FOUND,
        node="node1",
        searched_types=[],
    ),
]

class AssertInvalidCibMixin:
    def assert_raises_invalid_cib_content(
        self,
        report,
        extra_reports=None,
        can_be_more_verbose=True,
        verbose=False,
     ):
        extra_reports = extra_reports if extra_reports else []
        self.env_assist.assert_raise_library_error(
            lambda: verify(self.env_assist.get_env(), verbose),
            [
                fixture.error(
                    report_codes.INVALID_CIB_CONTENT,
                    report=report,
                    can_be_more_verbose=can_be_more_verbose,
                ),
            ] + extra_reports,
        )


class CibAsWholeValid(TestCase):
    def setUp(self):
        self.env_assist, self.config = get_env_tools(test_case=self)
        self.config.runner.pcmk.verify()

    def test_success_on_valid(self):
        (self.config
            .runner.cib.load()
            .runner.pcmk.load_state()
        )
        verify(self.env_assist.get_env())

    def test_fail_on_invalid_fence_topology(self):
        (self.config
            .runner.cib.load(optional_in_conf=BAD_FENCING_TOPOLOGY)
            .runner.pcmk.load_state()
        )
        self.env_assist.assert_raise_library_error(
            lambda: verify(self.env_assist.get_env()),
            list(BAD_FENCING_TOPOLOGY_REPORTS)
        )


class CibAsWholeInvalid(TestCase, AssertInvalidCibMixin):
    def setUp(self):
        self.env_assist, self.config = get_env_tools(test_case=self)
        self.config.runner.pcmk.verify(
            stderr="".join(CRM_VERIFY_ERROR_REPORT_LINES)
        )

    def test_fail_immediately_on_unloadable_cib(self):
        self.config.runner.cib.load(returncode=1)
        self.assert_raises_invalid_cib_content(CRM_VERIFY_ERROR_REPORT_LINES[0])

    def test_continue_on_loadable_cib(self):
        (self.config
            .runner.cib.load()
            .runner.pcmk.load_state()
        )
        self.assert_raises_invalid_cib_content(CRM_VERIFY_ERROR_REPORT_LINES[0])

    def test_add_following_errors(self):
        #More fencing topology tests are provided by tests of
        #pcs.lib.commands.fencing_topology
        (self.config
            .runner.cib.load(optional_in_conf=BAD_FENCING_TOPOLOGY)
            .runner.pcmk.load_state()
        )
        self.assert_raises_invalid_cib_content(
            CRM_VERIFY_ERROR_REPORT_LINES[0],
            extra_reports=list(BAD_FENCING_TOPOLOGY_REPORTS)
        )

class CibIsMocked(TestCase, AssertInvalidCibMixin):
    def setUp(self):
        self.env_assist, self.config = get_env_tools(test_case=self)
        self.cib_tempfile = "/fake/tmp/file"
        self.config.env.set_cib_data("<cib/>", cib_tempfile=self.cib_tempfile)

    def test_success_on_valid_cib(self):
        (self.config
            .runner.pcmk.verify(cib_tempfile=self.cib_tempfile)
            .runner.cib.load()
            .runner.pcmk.load_state()
        )
        verify(self.env_assist.get_env())

    def test_fail_on_invalid_cib(self):
        (self.config
            .runner.pcmk.verify(
                stderr="".join(CRM_VERIFY_ERROR_REPORT_LINES),
                cib_tempfile=self.cib_tempfile,
            )
            .runner.cib.load()
            .runner.pcmk.load_state()
        )
        self.assert_raises_invalid_cib_content(CRM_VERIFY_ERROR_REPORT_LINES[0])


class VerboseMode(TestCase, AssertInvalidCibMixin):
    def setUp(self):
        self.env_assist, self.config = get_env_tools(test_case=self)

    def test_success_on_valid_cib(self):
        (self.config
            .runner.pcmk.verify(verbose=True)
            .runner.cib.load()
            .runner.pcmk.load_state()
        )
        verify(self.env_assist.get_env(), verbose=True)

    def test_fail_on_invalid_cib(self):
        (self.config
            .runner.pcmk.verify(
                stderr=CRM_VERIFY_ERROR_REPORT_LINES[0],
                verbose=True,
            )
            .runner.cib.load()
            .runner.pcmk.load_state()
        )
        self.assert_raises_invalid_cib_content(
            CRM_VERIFY_ERROR_REPORT_LINES[0],
            can_be_more_verbose=False,
            verbose=True,
        )
