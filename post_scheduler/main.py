"""Modulo para realizar o scheduler das postagens de forma dinamica"""

import json
from datetime import datetime

def exec_scheduler(date_time: str = None, settings_path: str = r'post_scheduler\settings.json'):
    # If date_time is empty, use current time
    if not date_time:
        current_time = datetime.now()
    else:
        current_time = datetime.strptime(date_time, '%Y-%m-%d %H:%M')
    
    # Get current day and time
    current_day = current_time.strftime('%a').lower()
    current_hour_min = current_time.strftime('%H:%M')

    # Read settings file
    with open(settings_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    config_users = config['users']

    # Check each user's schedule
    for user in config_users:
        for schedule in user['schedule']:
            if schedule['day'] == current_day and schedule['time'] == current_hour_min:
                return {
                    'found': True,
                    'user': user['name'],
                    'topic': schedule['topic'],
                    'time': schedule['time']
                }
    
    return {'found': False}

if __name__ == '__main__':
    exec_scheduler('', 'settings.json')