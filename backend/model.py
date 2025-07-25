import json
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import numpy as np
from dataclasses import dataclass


@dataclass
class UserContext:
    """User context for personalized interventions"""
    typical_productive_hours: List[int]
    distraction_patterns: Dict[str, float]
    response_history: List[Dict]
    productivity_score: float
    stress_indicators: List[str]


class ProductivityModel:
    """AI model for productivity management and interventions"""
    
    def __init__(self):
        self.intervention_templates = {
            'motivational': [
                "You've been on {domain} for {time_spent} minutes. Is this helping you achieve your goals today?",
                "Take a moment to reflect: Is continuing on {domain} the best use of your time right now?",
                "You're {time_over} minutes over your limit on {domain}. What would make you feel more accomplished?"
            ],
            'reflective': [
                "Before continuing on {domain}, what's one productive task you could complete in the next 10 minutes?",
                "You've exceeded your {domain} limit. What drew you here, and is it still relevant?",
                "Pause and consider: How will you feel about this time on {domain} at the end of the day?"
            ],
            'goal_oriented': [
                "You set limits on {domain} for a reason. What goal were you trying to protect?",
                "Your future self is counting on the choices you make now. Continue on {domain}?",
                "What's one small step toward your goals you could take instead of staying on {domain}?"
            ],
            'time_awareness': [
                "You've spent {time_spent} minutes on {domain} today. How does that align with your priorities?",
                "Time check: {time_spent} minutes on {domain}. Is this how you planned to spend your day?",
                "You're {time_over} minutes over your {domain} limit. How will you use the next 10 minutes?"
            ]
        }
        
        self.user_profiles = {}
        self.behavioral_patterns = {}
        
    def update_distraction_patterns(self, user_id: str, urls: List[Dict]) -> None:
        """Update user's distraction patterns"""
        if user_id not in self.user_profiles:
            self.user_profiles[user_id] = {
                'distraction_urls': [],
                'productive_urls': [],
                'intervention_history': [],
                'performance_metrics': {}
            }
        
        self.user_profiles[user_id]['distraction_urls'] = urls
        
    def update_productive_patterns(self, user_id: str, urls: List[Dict]) -> None:
        """Update user's productive patterns"""
        if user_id not in self.user_profiles:
            self.user_profiles[user_id] = {
                'distraction_urls': [],
                'productive_urls': [],
                'intervention_history': [],
                'performance_metrics': {}
            }
        
        self.user_profiles[user_id]['productive_urls'] = urls
        
    def process_usage_data(self, usage_data: Dict) -> None:
        """Process usage data to identify patterns"""
        user_id = usage_data['user_id']
        domain = usage_data['domain']
        duration = usage_data['duration']
        interactions = usage_data['interactions']
        
        # Initialize behavioral patterns if not exists
        if user_id not in self.behavioral_patterns:
            self.behavioral_patterns[user_id] = {
                'time_patterns': {},
                'engagement_patterns': {},
                'productivity_scores': []
            }
        
        # Update time patterns
        hour = datetime.fromtimestamp(usage_data['timestamp'] / 1000).hour
        if hour not in self.behavioral_patterns[user_id]['time_patterns']:
            self.behavioral_patterns[user_id]['time_patterns'][hour] = {}
        
        if domain not in self.behavioral_patterns[user_id]['time_patterns'][hour]:
            self.behavioral_patterns[user_id]['time_patterns'][hour][domain] = []
        
        self.behavioral_patterns[user_id]['time_patterns'][hour][domain].append(duration)
        
        # Calculate engagement score based on interactions
        engagement_score = self._calculate_engagement_score(interactions, duration)
        
        if domain not in self.behavioral_patterns[user_id]['engagement_patterns']:
            self.behavioral_patterns[user_id]['engagement_patterns'][domain] = []
        
        self.behavioral_patterns[user_id]['engagement_patterns'][domain].append(engagement_score)
        
        # Update productivity score (simple average for now)
        is_productive = usage_data.get('is_productive', False)
        is_distraction = usage_data.get('is_distraction', False)
        score = duration if is_productive else -duration if is_distraction else 0
        self.behavioral_patterns[user_id]['productivity_scores'].append(score)
        
    def _calculate_engagement_score(self, interactions: Dict, duration: int) -> float:
        """Calculate engagement score based on interactions and duration"""
        # Simple formula: (clicks + scrolls + keystrokes) / duration, normalized
        total_interactions = sum(interactions.get(key, 0) for key in ['clicks', 'scrolls', 'keystrokes'])
        if duration == 0:
            return 0.0
        return min(1.0, total_interactions / duration)
    
    def analyze_tab_activity(self, tab_data: Dict) -> Optional[Dict]:
        """Analyze tab activity for patterns and determine if alert is needed"""
        user_id = tab_data['user_id']
        url = tab_data['url']
        time_of_day = tab_data['time_of_day']
        
        # Simple logic: Check if this is a distraction during non-productive hours
        if user_id in self.user_profiles:
            distractions = self.user_profiles[user_id].get('distraction_urls', [])
            if any(d['url'] == url for d in distractions):
                # Assume productive hours are 9-17 for demo
                if not (9 <= time_of_day <= 17):
                    return {'type': 'distraction_alert', 'message': 'This might be a distraction outside productive hours!'}
        return None
    
    def generate_intervention_question(self, domain: str, excess_time: int, user_context: UserContext) -> str:
        """Generate personalized intervention question"""
        # Select template type based on user context (e.g., high stress -> reflective)
        if user_context.stress_indicators:
            template_type = 'reflective'
        elif user_context.productivity_score < 0.5:
            template_type = 'motivational'
        else:
            template_type = random.choice(list(self.intervention_templates.keys()))
        
        template = random.choice(self.intervention_templates[template_type])
        time_spent = excess_time + 10  # Assume some base time for demo
        time_over = excess_time
        
        return template.format(domain=domain, time_spent=time_spent, time_over=time_over)
    
    def process_intervention_response(self, interaction: Dict) -> Dict:
        """Process user's response to intervention and determine rewards/penalties"""
        user_id = interaction['user_id']
        answer = interaction['answer'].lower()
        
        # Simple NLP-like processing: Look for positive/negative keywords
        positive_keywords = ['yes', 'productive', 'goal', 'continue']
        negative_keywords = ['no', 'distraction', 'stop', 'close']
        
        if any(word in answer for word in positive_keywords):
            reward_points = 10
            updated_limits = {'extended_time': 5}  # Minutes
        elif any(word in answer for word in negative_keywords):
            reward_points = 5
            updated_limits = {'reduced_time': 10}
        else:
            reward_points = 0
            updated_limits = None
        
        # Store in history
        if user_id in self.user_profiles:
            self.user_profiles[user_id]['intervention_history'].append(interaction)
        
        result = {}
        if reward_points > 0:
            result['reward_points'] = reward_points
        if updated_limits:
            result['updated_limits'] = updated_limits
        
        return result
    
    def generate_productivity_insights(self, user_data: Dict) -> List[str]:
        """Generate insights from user analytics data"""
        insights = []
        
        # Example insights based on data
        if 'total_time' in user_data and user_data['total_time'] > 480:  # 8 hours
            insights.append("You're spending over 8 hours online daily. Consider setting stricter limits.")
        
        if 'top_distractions' in user_data:
            top = user_data['top_distractions'][0] if user_data['top_distractions'] else 'none'
            insights.append(f"Your top distraction is {top}. Try blocking it during work hours.")
        
        # Use behavioral patterns if available
        for user_id in self.behavioral_patterns:
            scores = self.behavioral_patterns[user_id]['productivity_scores']
            if scores:
                avg_score = np.mean(scores)
                if avg_score > 0:
                    insights.append(f"Overall productivity is positive with average score {avg_score:.2f}.")
                else:
                    insights.append(f"Productivity needs improvement; current average score is {avg_score:.2f}.")
        
        return insights
    
    def recommend_limit_adjustments(self, performance_data: Dict) -> Dict:
        """Recommend adjustments to time limits based on performance"""
        recommendations = {
            'distraction_adjustments': {},
            'productive_adjustments': {}
        }
        
        # Simple logic: If overuse on distractions, reduce limits
        if 'distraction_usage' in performance_data:
            for domain, time in performance_data['distraction_usage'].items():
                if time > 60:  # Over 1 hour
                    recommendations['distraction_adjustments'][domain] = {'new_limit': 30}
        
        if 'productive_usage' in performance_data:
            for domain, time in performance_data['productive_usage'].items():
                if time < 120:  # Under 2 hours
                    recommendations['productive_adjustments'][domain] = {'new_target': 180}
        
        return recommendations
    
    def generate_daily_summary(self, daily_data: Dict) -> Dict:
        """Generate daily productivity summary"""
        summary = {
            'total_productive_time': 0,
            'total_distraction_time': 0,
            'key_insights': []
        }
        
        if 'usage_entries' in daily_data:
            for entry in daily_data['usage_entries']:
                duration = entry.get('duration', 0)
                if entry.get('is_productive'):
                    summary['total_productive_time'] += duration
                if entry.get('is_distraction'):
                    summary['total_distraction_time'] += duration
        
        productive_hours = summary['total_productive_time'] / 60
        distraction_hours = summary['total_distraction_time'] / 60
        summary['key_insights'].append(f"Productive time: {productive_hours:.1f} hours")
        summary['key_insights'].append(f"Distraction time: {distraction_hours:.1f} hours")
        
        if productive_hours > distraction_hours:
            summary['key_insights'].append("Great job! You were more productive than distracted today.")
        else:
            summary['key_insights'].append("Consider reducing distractions tomorrow for better productivity.")
        
        return summary
