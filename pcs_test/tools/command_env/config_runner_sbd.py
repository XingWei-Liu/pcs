from pcs_test.tools.command_env.mock_runner import Call as RunnerCall

from pcs import settings

class SbdShortcuts:
    def __init__(self, calls):
        self.__calls = calls

    def list_watchdogs(
        self,
        output,
        name="runner.sbd.list_watchdogs",
        stderr="",
        returncode=0,
        instead=None,
        before=None
    ):
        self.__calls.place(
            name,
            RunnerCall(
                "{} query-watchdog".format(settings.sbd_binary),
                stdout=output,
                stderr=stderr,
                returncode=returncode,
            ),
            before=before,
            instead=instead
        )
