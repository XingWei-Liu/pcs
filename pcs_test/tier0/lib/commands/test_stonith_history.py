from unittest import TestCase

from pcs_test.tools import fixture
from pcs_test.tools.command_env import get_env_tools

from pcs.common import report_codes
from pcs.lib.commands import stonith


class HistoryGetText(TestCase):
    def setUp(self):
        self.env_assist, self.config = get_env_tools(test_case=self)
        self.config.runner.pcmk.can_fence_history_manage()

    def test_success_all_nodes(self):
        history = (
            "rh80-node1 was able to reboot node rh80-node2 on behalf of "
            "pacemaker-controld.835 from rh80-node1 at Wed Oct 10 09:56:47 2018"
            "\n"
            "rh80-node2 was able to reboot node rh80-node1 on behalf of "
            "pacemaker-controld.835 from rh80-node2 at Wed Oct 10 09:58:47 2018"
            "\n"
        )
        self.config.runner.pcmk.fence_history_get(stdout=history, node="*")
        output = stonith.history_get_text(self.env_assist.get_env())
        self.assertEqual(output, history.strip())

    def test_success_one_node(self):
        history = (
            "rh80-node1 was able to reboot node rh80-node2 on behalf of "
            "pacemaker-controld.835 from rh80-node1 at Wed Oct 10 09:56:47 2018"
            "\n"
            "\n"
        )
        node = "rh80-node2"
        self.config.runner.pcmk.fence_history_get(stdout=history, node=node)
        output = stonith.history_get_text(self.env_assist.get_env(), node)
        self.assertEqual(output, history.strip())

    def test_error(self):
        stdout = "some output\n"
        stderr = "some error\n"
        self.config.runner.pcmk.fence_history_get(
            stdout=stdout,
            stderr=stderr,
            returncode=1,
            node="*"
        )
        self.env_assist.assert_raise_library_error(
            lambda: stonith.history_get_text(self.env_assist.get_env()),
            [
                fixture.error(
                    report_codes.FENCE_HISTORY_COMMAND_ERROR,
                    command_label="show",
                    reason=(stderr + stdout).strip(),
                )
            ],
            expected_in_processor=False
        )

    def test_history_not_supported(self):
        self.config.runner.pcmk.can_fence_history_manage(
            stderr="not supported",
            name="runner.pcmk.can_fence_history_manage",
            instead="runner.pcmk.can_fence_history_manage",
        )
        self.env_assist.assert_raise_library_error(
            lambda: stonith.history_get_text(self.env_assist.get_env()),
            [
                fixture.error(
                    report_codes.FENCE_HISTORY_NOT_SUPPORTED,
                )
            ],
            expected_in_processor=False
        )


class HistoryCleanup(TestCase):
    def setUp(self):
        self.env_assist, self.config = get_env_tools(test_case=self)
        self.config.runner.pcmk.can_fence_history_manage()

    def test_success_all_nodes(self):
        msg = "cleaning up fencing-history for node *\n"
        self.config.runner.pcmk.fence_history_cleanup(stdout=msg, node="*")
        output = stonith.history_cleanup(self.env_assist.get_env())
        self.assertEqual(output, msg.strip())

    def test_success_one_node(self):
        node = "rh80-node2"
        msg = f"cleaning up fencing-history for node {node}\n"
        self.config.runner.pcmk.fence_history_cleanup(stdout=msg, node=node)
        output = stonith.history_cleanup(self.env_assist.get_env(), node)
        self.assertEqual(output, msg.strip())

    def test_error(self):
        stdout = "some output\n"
        stderr = "some error\n"
        self.config.runner.pcmk.fence_history_cleanup(
            stdout=stdout,
            stderr=stderr,
            returncode=1,
            node="*"
        )
        self.env_assist.assert_raise_library_error(
            lambda: stonith.history_cleanup(self.env_assist.get_env()),
            [
                fixture.error(
                    report_codes.FENCE_HISTORY_COMMAND_ERROR,
                    command_label="cleanup",
                    reason=(stderr + stdout).strip(),
                )
            ],
            expected_in_processor=False
        )

    def test_history_not_supported(self):
        self.config.runner.pcmk.can_fence_history_manage(
            stderr="not supported",
            name="runner.pcmk.can_fence_history_manage",
            instead="runner.pcmk.can_fence_history_manage",
        )
        self.env_assist.assert_raise_library_error(
            lambda: stonith.history_cleanup(self.env_assist.get_env()),
            [
                fixture.error(
                    report_codes.FENCE_HISTORY_NOT_SUPPORTED,
                )
            ],
            expected_in_processor=False
        )


class HistoryUpdate(TestCase):
    def setUp(self):
        self.env_assist, self.config = get_env_tools(test_case=self)
        self.config.runner.pcmk.can_fence_history_manage()

    def test_success_all_nodes(self):
        msg = "gather fencing-history from all nodes\n"
        self.config.runner.pcmk.fence_history_update(stdout=msg)
        output = stonith.history_update(self.env_assist.get_env())
        self.assertEqual(output, msg.strip())

    def test_error(self):
        stdout = "some output\n"
        stderr = "some error\n"
        self.config.runner.pcmk.fence_history_update(
            stdout=stdout,
            stderr=stderr,
            returncode=1,
        )
        self.env_assist.assert_raise_library_error(
            lambda: stonith.history_update(self.env_assist.get_env()),
            [
                fixture.error(
                    report_codes.FENCE_HISTORY_COMMAND_ERROR,
                    command_label="update",
                    reason=(stderr + stdout).strip(),
                )
            ],
            expected_in_processor=False
        )

    def test_history_not_supported(self):
        self.config.runner.pcmk.can_fence_history_manage(
            stderr="not supported",
            name="runner.pcmk.can_fence_history_manage",
            instead="runner.pcmk.can_fence_history_manage",
        )
        self.env_assist.assert_raise_library_error(
            lambda: stonith.history_update(self.env_assist.get_env()),
            [
                fixture.error(
                    report_codes.FENCE_HISTORY_NOT_SUPPORTED,
                )
            ],
            expected_in_processor=False
        )
