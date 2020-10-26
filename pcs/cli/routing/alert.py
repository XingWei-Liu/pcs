from pcs import (
    alert,
    usage,
)
from pcs.cli.common.routing import create_router


alert_cmd = create_router(
    {
        "help": lambda lib, argv, modifiers: usage.alert(argv),
        "create": alert.alert_add,
        "update": alert.alert_update,
        "delete": alert.alert_remove,
        "remove": alert.alert_remove,
        "config": alert.print_alert_config,
        "show": alert.print_alert_config,
        "recipient": create_router(
            {
                "help": lambda lib, argv, modifiers: usage.alert(["recipient"]),
                "add": alert.recipient_add,
                "update": alert.recipient_update,
                "delete": alert.recipient_remove,
                "remove": alert.recipient_remove,
            },
            ["alert", "recipient"],
        ),
        "get_all_alerts": alert.print_alerts_in_json,
    },
    ["alert"],
    default_cmd="config",
)
