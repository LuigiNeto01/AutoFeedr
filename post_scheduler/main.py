"""Modulo para realizar o scheduler das postagens de forma dinamica"""

import json
from datetime import datetime
from pathlib import Path

def exec_scheduler(date_time: str = None, settings_path: str | Path = None):
    # If date_time is empty, use current time
    if not date_time:
        current_time = datetime.now()
    else:
        current_time = datetime.strptime(date_time, '%Y-%m-%d %H:%M')
    
    # Get current day and time
    current_day = current_time.strftime('%a').lower()
    current_hour_min = current_time.strftime('%H:%M')
    print(f"Checando agenda para {current_day} as {current_hour_min}")

    # Read settings file
    if settings_path is None:
        settings_path = Path("post_scheduler") / "settings.json"
    else:
        settings_path = Path(settings_path)
    print(f"Lendo configuracoes em {settings_path}")
    with settings_path.open('r', encoding='utf-8') as f:
        config = json.load(f)
    
    config_users = config['users']

    # Check each user's schedule
    for user in config_users:
        for schedule in user['schedule']:
            if schedule['day'] == current_day and schedule['time'] == current_hour_min:
                print(f"Agenda encontrada para {user['name']} (topic={schedule['topic']})")
                return {
                    'found': True,
                    'user': user['name'],
                    'topic': schedule['topic'],
                    'time': schedule['time']
                }
    
    print("Nenhum agendamento correspondente encontrado.")
    return {'found': False}

if __name__ == '__main__':
    exec_scheduler('', 'settings.json')
