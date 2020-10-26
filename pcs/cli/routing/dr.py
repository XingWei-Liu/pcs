from pcs import usage
from pcs.cli import dr
from pcs.cli.common.routing import create_router

dr_cmd = create_router(
    {
        "help": lambda lib, argv, modifiers: usage.dr(argv),
        "config": dr.config,
        "destroy": dr.destroy,
        "set-recovery-site": dr.set_recovery_site,
        "status": dr.status,
    },
    ["dr"],
    default_cmd="help",
)
