from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import json
import os
from model import ProductivityModel
from db import DatabaseManager

app = Flask(__name__)
CORS(app)

# Initialize components
db_manager = DatabaseManager()
model = ProductivityModel()

@app.route('/api/distraction-urls', methods=['POST'])
def handle_distraction_urls():
    """Handle distraction URLs from extension"""
    try:
        data = request.json
        urls = data.get('urls', [])
        user_id = data.get('user_id', 'default_user')  # In real app, get from auth
        
        # Store in database
        db_manager.store_distraction_urls(user_id, urls)
        
        # Update model with new data
        model.update_distraction_patterns(user_id, urls)
        
        return jsonify({
            'status': 'success',
            'message': 'Distraction URLs updated'
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/productive-urls', methods=['POST'])
def handle_productive_urls():
    """Handle productive URLs from extension"""
    try:
        data = request.json
        urls = data.get('urls', [])
        user_id = data.get('user_id', 'default_user')
        
        # Store in database
        db_manager.store_productive_urls(user_id, urls)
        
        # Update model with new data
        model.update_productive_patterns(user_id, urls)
        
        return jsonify({
            'status': 'success',
            'message': 'Productive URLs updated'
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/usage-data', methods=['POST'])
def handle_usage_data():
    """Handle usage data from extension"""
    try:
        data = request.json
        user_id = data.get('user_id', 'default_user')
        
        # Store usage data
        usage_entry = {
            'user_id': user_id,
            'url': data.get('url'),
            'domain': data.get('domain'),
            'duration': data.get('duration'),
            'interactions': data.get('interactions', {}),
            'timestamp': data.get('timestamp'),
            'is_distraction': data.get('isDistraction', False),
            'is_productive': data.get('isProductive', False)
        }
        
        db_manager.store_usage_data(usage_entry)
        
        # Update model with usage patterns
        model.process_usage_data(usage_entry)
        
        return jsonify({
            'status': 'success',
            'message': 'Usage data recorded'
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/tab-activity', methods=['POST'])
def handle_tab_activity():
    """Handle tab activity data"""
    try:
        data = request.json
        user_id = data.get('user_id', 'default_user')
        
        tab_data = {
            'user_id': user_id,
            'url': data.get('url'),
            'title': data.get('title'),
            'timestamp': data.get('timestamp'),
            'time_of_day': data.get('timeOfDay')
        }
        
        # Store tab activity
        db_manager.store_tab_activity(tab_data)
        
        # Analyze tab activity for patterns
        should_alert = model.analyze_tab_activity(tab_data)
        
        response = {'status': 'success'}
        if should_alert:
            response['alert'] = should_alert
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/get-question', methods=['POST'])
def get_question():
    """Get AI-generated question for user when they exceed limits"""
    try:
        data = request.json
        domain = data.get('domain')
        excess_time = data.get('excessTime', 0)
        user_id = data.get('user_id', 'default_user')
        
        # Get user's context and history
        user_context = db_manager.get_user_context(user_id)
        
        # Generate personalized question using AI model
        question = model.generate_intervention_question(
            domain=domain,
            excess_time=excess_time,
            user_context=user_context
        )
        
        return jsonify({
            'question': question,
            'domain': domain,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({
            'question': 'You have exceeded your time limit. Do you want to continue?'
        })

@app.route('/api/question-answer', methods=['POST'])
def handle_question_answer():
    """Handle user's answer to intervention question"""
    try:
        data = request.json
        answer = data.get('answer')
        domain = data.get('domain')
        user_id = data.get('user_id', 'default_user')
        timestamp = data.get('timestamp')
        
        # Store the interaction
        interaction = {
            'user_id': user_id,
            'domain': domain,
            'answer': answer,
            'timestamp': timestamp
        }
        
        db_manager.store_intervention_response(interaction)
        
        # Process the answer and determine rewards/penalties
        result = model.process_intervention_response(interaction)
        
        response = {
            'status': 'success',
            'message': 'Response recorded'
        }
        
        # Add reward points if applicable
        if result.get('reward_points'):
            response['rewardPoints'] = result['reward_points']
        
        # Add updated time limits if applicable
        if result.get('updated_limits'):
            response['updatedLimits'] = result['updated_limits']
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/get-insights', methods=['GET'])
def get_insights():
    """Get AI-generated insights about user's productivity patterns"""
    try:
        user_id = request.args.get('user_id', 'default_user')
        
        # Get user data
        user_data = db_manager.get_user_analytics_data(user_id)
        
        # Generate insights using AI model
        insights = model.generate_productivity_insights(user_data)
        
        return jsonify({
            'insights': insights,
            'generated_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({
            'insights': [],
            'error': str(e)
        }), 500

@app.route('/api/adjust-limits', methods=['POST'])
def adjust_limits():
    """Adjust time limits based on AI recommendations"""
    try:
        data = request.json
        user_id = data.get('user_id', 'default_user')
        
        # Get current user performance
        performance_data = db_manager.get_user_performance(user_id)
        
        # Get AI recommendations for limit adjustments
        recommendations = model.recommend_limit_adjustments(performance_data)
        
        # Update limits in database
        if recommendations.get('distraction_adjustments'):
            db_manager.update_distraction_limits(user_id, recommendations['distraction_adjustments'])
        
        if recommendations.get('productive_adjustments'):
            db_manager.update_productive_targets(user_id, recommendations['productive_adjustments'])
        
        return jsonify({
            'status': 'success',
            'recommendations': recommendations,
            'applied_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/daily-summary', methods=['GET'])
def get_daily_summary():
    """Get daily productivity summary"""
    try:
        user_id = request.args.get('user_id', 'default_user')
        date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        # Get daily data
        daily_data = db_manager.get_daily_data(user_id, date)
        
        # Generate summary using AI
        summary = model.generate_daily_summary(daily_data)
        
        return jsonify({
            'summary': summary,
            'date': date,
            'generated_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({
            'summary': {},
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'status': 'error',
        'message': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'status': 'error',
        'message': 'Internal server error'
    }), 500

if __name__ == '__main__':
    # Initialize database
    db_manager.initialize_database()
    
    # Start the server
    app.run(
        host='localhost',
        port=5000,
        debug=True,
        threaded=True
    )