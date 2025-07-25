import sqlite3
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from model import UserContext  # Import UserContext from model.py


class DatabaseManager:
    """Database manager for productivity data using SQLite"""

    def __init__(self, db_name='productivity.db'):
        self.conn = sqlite3.connect(db_name, check_same_thread=False)  # Allow multi-threaded access
        self.cursor = self.conn.cursor()

    def initialize_database(self):
        """Initialize all necessary database tables"""
        # Users table (optional, for future expansion)
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                created_at TEXT
            )
        ''')

        # Distraction URLs
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS distraction_urls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                url TEXT,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')

        # Productive URLs
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS productive_urls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                url TEXT,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')

        # Usage data
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS usage_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                url TEXT,
                domain TEXT,
                duration INTEGER,
                interactions_json TEXT,
                timestamp TEXT,
                is_distraction BOOLEAN,
                is_productive BOOLEAN,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')

        # Tab activity
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS tab_activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                url TEXT,
                title TEXT,
                timestamp TEXT,
                time_of_day INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')

        # Intervention responses
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS intervention_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                domain TEXT,
                answer TEXT,
                timestamp TEXT,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')

        # Distraction limits
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS distraction_limits (
                user_id TEXT,
                domain TEXT,
                limit_minutes INTEGER,
                PRIMARY KEY (user_id, domain),
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')

        # Productive targets
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS productive_targets (
                user_id TEXT,
                domain TEXT,
                target_minutes INTEGER,
                PRIMARY KEY (user_id, domain),
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')

        self.conn.commit()

    def _ensure_user_exists(self, user_id: str):
        """Helper to ensure user exists in users table"""
        self.cursor.execute('SELECT user_id FROM users WHERE user_id = ?', (user_id,))
        if not self.cursor.fetchone():
            self.cursor.execute('INSERT INTO users (user_id, created_at) VALUES (?, ?)',
                                (user_id, datetime.now().isoformat()))
            self.conn.commit()

    def store_distraction_urls(self, user_id: str, urls: List[str]):
        """Store distraction URLs for a user"""
        self._ensure_user_exists(user_id)
        # Delete existing for user to update
        self.cursor.execute('DELETE FROM distraction_urls WHERE user_id = ?', (user_id,))
        for url in urls:
            self.cursor.execute('INSERT INTO distraction_urls (user_id, url) VALUES (?, ?)', (user_id, url))
        self.conn.commit()

    def store_productive_urls(self, user_id: str, urls: List[str]):
        """Store productive URLs for a user"""
        self._ensure_user_exists(user_id)
        # Delete existing for user to update
        self.cursor.execute('DELETE FROM productive_urls WHERE user_id = ?', (user_id,))
        for url in urls:
            self.cursor.execute('INSERT INTO productive_urls (user_id, url) VALUES (?, ?)', (user_id, url))
        self.conn.commit()

    def store_usage_data(self, usage_entry: Dict):
        """Store usage data entry"""
        self._ensure_user_exists(usage_entry['user_id'])
        interactions_json = json.dumps(usage_entry['interactions'])
        self.cursor.execute('''
            INSERT INTO usage_data 
            (user_id, url, domain, duration, interactions_json, timestamp, is_distraction, is_productive)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (usage_entry['user_id'], usage_entry['url'], usage_entry['domain'], usage_entry['duration'],
              interactions_json, usage_entry['timestamp'], usage_entry['is_distraction'], usage_entry['is_productive']))
        self.conn.commit()

    def store_tab_activity(self, tab_data: Dict):
        """Store tab activity data"""
        self._ensure_user_exists(tab_data['user_id'])
        self.cursor.execute('''
            INSERT INTO tab_activity 
            (user_id, url, title, timestamp, time_of_day)
            VALUES (?, ?, ?, ?, ?)
        ''', (tab_data['user_id'], tab_data['url'], tab_data['title'], tab_data['timestamp'], tab_data['time_of_day']))
        self.conn.commit()

    def store_intervention_response(self, interaction: Dict):
        """Store intervention response"""
        self._ensure_user_exists(interaction['user_id'])
        self.cursor.execute('''
            INSERT INTO intervention_responses 
            (user_id, domain, answer, timestamp)
            VALUES (?, ?, ?, ?)
        ''', (interaction['user_id'], interaction['domain'], interaction['answer'], interaction['timestamp']))
        self.conn.commit()

    def get_user_context(self, user_id: str) -> UserContext:
        """Get or compute user context (simplified computation for demo)"""
        self._ensure_user_exists(user_id)
        
        # Compute typical productive hours (e.g., hours with more productive usage)
        self.cursor.execute('''
            SELECT strftime('%H', timestamp) as hour, SUM(duration) as total
            FROM usage_data 
            WHERE user_id = ? AND is_productive = 1
            GROUP BY hour
            ORDER BY total DESC
            LIMIT 5
        ''', (user_id,))
        productive_hours = [int(row[0]) for row in self.cursor.fetchall()]
        
        # Distraction patterns (domain -> avg duration)
        self.cursor.execute('''
            SELECT domain, AVG(duration) as avg_duration
            FROM usage_data 
            WHERE user_id = ? AND is_distraction = 1
            GROUP BY domain
        ''', (user_id,))
        distraction_patterns = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        # Response history
        self.cursor.execute('SELECT domain, answer, timestamp FROM intervention_responses WHERE user_id = ?', (user_id,))
        response_history = [{'domain': r[0], 'answer': r[1], 'timestamp': r[2]} for r in self.cursor.fetchall()]
        
        # Productivity score (simple: avg of (productive_duration - distraction_duration))
        self.cursor.execute('''
            SELECT AVG(CASE WHEN is_productive THEN duration ELSE -duration END) as score
            FROM usage_data WHERE user_id = ?
        ''', (user_id,))
        productivity_score = self.cursor.fetchone()[0] or 0.0
        
        # Stress indicators (placeholder: based on keywords in answers)
        stress_indicators = ['high' if 'stressed' in h['answer'] else 'low' for h in response_history]
        
        return UserContext(
            typical_productive_hours=productive_hours or [9, 10, 11, 12, 13],  # Default
            distraction_patterns=distraction_patterns,
            response_history=response_history,
            productivity_score=productivity_score,
            stress_indicators=stress_indicators
        )

    def get_user_analytics_data(self, user_id: str) -> Dict:
        """Get analytics data for insights"""
        self._ensure_user_exists(user_id)
        
        # Total time
        self.cursor.execute('SELECT SUM(duration) FROM usage_data WHERE user_id = ?', (user_id,))
        total_time = self.cursor.fetchone()[0] or 0
        
        # Top distractions
        self.cursor.execute('''
            SELECT domain, SUM(duration) as total
            FROM usage_data WHERE user_id = ? AND is_distraction = 1
            GROUP BY domain ORDER BY total DESC LIMIT 3
        ''', (user_id,))
        top_distractions = [row[0] for row in self.cursor.fetchall()]
        
        return {
            'total_time': total_time,
            'top_distractions': top_distractions
        }

    def get_user_performance(self, user_id: str) -> Dict:
        """Get performance data for limit adjustments"""
        self._ensure_user_exists(user_id)
        
        # Distraction usage
        self.cursor.execute('''
            SELECT domain, SUM(duration) as total
            FROM usage_data WHERE user_id = ? AND is_distraction = 1
            GROUP BY domain
        ''', (user_id,))
        distraction_usage = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        # Productive usage
        self.cursor.execute('''
            SELECT domain, SUM(duration) as total
            FROM usage_data WHERE user_id = ? AND is_productive = 1
            GROUP BY domain
        ''', (user_id,))
        productive_usage = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        return {
            'distraction_usage': distraction_usage,
            'productive_usage': productive_usage
        }

    def update_distraction_limits(self, user_id: str, adjustments: Dict):
        """Update distraction limits"""
        self._ensure_user_exists(user_id)
        for domain, adj in adjustments.items():
            new_limit = adj.get('new_limit', 0)
            self.cursor.execute('''
                INSERT OR REPLACE INTO distraction_limits (user_id, domain, limit_minutes)
                VALUES (?, ?, ?)
            ''', (user_id, domain, new_limit))
        self.conn.commit()

    def update_productive_targets(self, user_id: str, adjustments: Dict):
        """Update productive targets"""
        self._ensure_user_exists(user_id)
        for domain, adj in adjustments.items():
            new_target = adj.get('new_target', 0)
            self.cursor.execute('''
                INSERT OR REPLACE INTO productive_targets (user_id, domain, target_minutes)
                VALUES (?, ?, ?)
            ''', (user_id, domain, new_target))
        self.conn.commit()

    def get_daily_data(self, user_id: str, date: str) -> Dict:
        """Get daily data for summary"""
        self._ensure_user_exists(user_id)
        start_date = f"{date} 00:00:00"
        end_date = f"{date} 23:59:59"
        
        self.cursor.execute('''
            SELECT * FROM usage_data 
            WHERE user_id = ? AND timestamp BETWEEN ? AND ?
        ''', (user_id, start_date, end_date))
        
        usage_entries = []
        for row in self.cursor.fetchall():
            usage_entries.append({
                'url': row[2],
                'domain': row[3],
                'duration': row[4],
                'is_distraction': bool(row[7]),
                'is_productive': bool(row[8])
            })
        
        return {'usage_entries': usage_entries}

    def close(self):
        """Close the database connection"""
        self.conn.close()
