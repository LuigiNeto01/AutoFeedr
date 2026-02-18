"""Modulo para realizar o scheduler das postagens de forma dinamica"""

import json
from datetime import datetime
from pathlib import Path
import logging


logger = logging.getLogger("autofeedr.scheduler")

def exec_scheduler(date_time: str = None, settings_path: str | Path = None):
    # If date_time is empty, use current time
    if not date_time:
        current_time = datetime.now()
    else:
        current_time = datetime.strptime(date_time, '%Y-%m-%d %H:%M')
    
    # Get current day and time
    current_day = current_time.strftime('%a').lower()
    current_hour_min = current_time.strftime('%H:%M')
    logger.info(
        "scheduler_time_resolved",
        extra={"fields": {"day": current_day, "time": current_hour_min}},
    )

    # Read settings file
    if settings_path is None:
        settings_path = Path("post_scheduler") / "settings.json"
    else:
        settings_path = Path(settings_path)
    logger.info(
        "scheduler_loading_settings",
        extra={"fields": {"settings_path": str(settings_path)}},
    )
    with settings_path.open('r', encoding='utf-8') as f:
        config = json.load(f)
    
    config_users = config['users']

    matches = []
    # Check each user's schedule
    for user in config_users:
        for schedule in user['schedule']:
            if schedule['day'] == current_day and schedule['time'] == current_hour_min:
                logger.info(
                    "scheduler_match_found",
                    extra={
                        "fields": {
                            "user": user["name"],
                            "topic": schedule["topic"],
                            "time": schedule["time"],
                        }
                    },
                )
                matches.append({
                    'user': user['name'],
                    'topic': schedule['topic'],
                    'time': schedule['time']
                })
    
    if matches:
        return {'found': True, 'matches': matches, 'minute': current_time.strftime("%Y-%m-%d %H:%M")}

    logger.info("scheduler_no_match")
    return {'found': False, 'matches': [], 'minute': current_time.strftime("%Y-%m-%d %H:%M")}

if __name__ == '__main__':
    exec_scheduler('', 'settings.json')
