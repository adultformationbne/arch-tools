#!/usr/bin/env python3
"""
Resource Monitor for LLM Analysis
Monitors CPU, Memory, and GPU usage during Ollama inference
"""

import psutil
import time
import subprocess
import json
import threading
from datetime import datetime

class ResourceMonitor:
    def __init__(self):
        self.monitoring = False
        self.data = []
        
    def get_ollama_process(self):
        """Find the Ollama process"""
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if 'ollama' in proc.info['name'] or any('ollama' in cmd for cmd in proc.info['cmdline']):
                    return psutil.Process(proc.info['pid'])
            except:
                continue
        return None
    
    def get_system_stats(self):
        """Get comprehensive system stats"""
        ollama_proc = self.get_ollama_process()
        
        # Basic system stats
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        
        stats = {
            'timestamp': datetime.now().isoformat(),
            'system_cpu_percent': cpu_percent,
            'system_memory_percent': memory.percent,
            'system_memory_used_gb': memory.used / (1024**3),
            'system_memory_available_gb': memory.available / (1024**3),
            'system_memory_total_gb': memory.total / (1024**3)
        }
        
        # Ollama-specific stats
        if ollama_proc:
            try:
                ollama_memory = ollama_proc.memory_info()
                stats.update({
                    'ollama_cpu_percent': ollama_proc.cpu_percent(),
                    'ollama_memory_mb': ollama_memory.rss / (1024**2),
                    'ollama_memory_vms_mb': ollama_memory.vms / (1024**2),
                    'ollama_num_threads': ollama_proc.num_threads(),
                    'ollama_status': ollama_proc.status()
                })
            except:
                stats.update({
                    'ollama_cpu_percent': 0,
                    'ollama_memory_mb': 0,
                    'ollama_status': 'not_found'
                })
        
        # Check for GPU usage (Apple Silicon)
        try:
            # Use powermetrics for GPU stats on macOS
            result = subprocess.run(['powermetrics', '-n', '1', '-s', 'gpu_power'], 
                                  capture_output=True, text=True, timeout=2)
            if result.returncode == 0 and 'GPU' in result.stdout:
                stats['gpu_activity'] = 'detected'
            else:
                stats['gpu_activity'] = 'none'
        except:
            stats['gpu_activity'] = 'unknown'
            
        return stats
    
    def start_monitoring(self, interval=1.0):
        """Start monitoring in background thread"""
        self.monitoring = True
        self.data = []
        
        def monitor_loop():
            while self.monitoring:
                try:
                    stats = self.get_system_stats()
                    self.data.append(stats)
                    time.sleep(interval)
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    print(f"Monitoring error: {e}")
                    time.sleep(interval)
        
        self.thread = threading.Thread(target=monitor_loop, daemon=True)
        self.thread.start()
        print(f"🔍 Resource monitoring started (interval: {interval}s)")
    
    def stop_monitoring(self):
        """Stop monitoring and return summary"""
        self.monitoring = False
        if hasattr(self, 'thread'):
            self.thread.join(timeout=2)
        
        if not self.data:
            return {}
            
        # Calculate summary statistics
        cpu_values = [d['system_cpu_percent'] for d in self.data if 'system_cpu_percent' in d]
        memory_values = [d['system_memory_used_gb'] for d in self.data if 'system_memory_used_gb' in d]
        ollama_cpu_values = [d['ollama_cpu_percent'] for d in self.data if 'ollama_cpu_percent' in d and d['ollama_cpu_percent'] > 0]
        ollama_memory_values = [d['ollama_memory_mb'] for d in self.data if 'ollama_memory_mb' in d and d['ollama_memory_mb'] > 0]
        
        summary = {
            'duration_seconds': len(self.data),
            'samples_collected': len(self.data),
            'system_cpu': {
                'avg': sum(cpu_values) / len(cpu_values) if cpu_values else 0,
                'max': max(cpu_values) if cpu_values else 0,
                'min': min(cpu_values) if cpu_values else 0
            },
            'system_memory_gb': {
                'avg': sum(memory_values) / len(memory_values) if memory_values else 0,
                'max': max(memory_values) if memory_values else 0,
                'peak_usage_percent': max([d['system_memory_percent'] for d in self.data if 'system_memory_percent' in d]) if self.data else 0
            },
            'ollama_process': {
                'cpu_avg': sum(ollama_cpu_values) / len(ollama_cpu_values) if ollama_cpu_values else 0,
                'cpu_max': max(ollama_cpu_values) if ollama_cpu_values else 0,
                'memory_avg_mb': sum(ollama_memory_values) / len(ollama_memory_values) if ollama_memory_values else 0,
                'memory_max_mb': max(ollama_memory_values) if ollama_memory_values else 0
            }
        }
        
        # Determine if system can handle larger models
        total_memory_gb = self.data[0]['system_memory_total_gb'] if self.data else 32
        peak_usage_gb = summary['system_memory_gb']['max']
        available_for_model = total_memory_gb - peak_usage_gb
        
        model_recommendations = []
        if available_for_model > 16:
            model_recommendations.append("✅ Can handle 70B models (needs ~16GB)")
        if available_for_model > 8:
            model_recommendations.append("✅ Can handle 14B models (needs ~8GB)")
        if available_for_model > 4:
            model_recommendations.append("✅ Can handle 8B models (needs ~4GB)")
        else:
            model_recommendations.append("⚠️  Stick to smaller models (<8B)")
            
        summary['model_recommendations'] = model_recommendations
        summary['estimated_available_memory_gb'] = available_for_model
        
        print("\n📊 Resource Usage Summary:")
        print(f"   Duration: {summary['duration_seconds']} seconds")
        print(f"   System CPU: {summary['system_cpu']['avg']:.1f}% avg, {summary['system_cpu']['max']:.1f}% peak")
        print(f"   System Memory: {summary['system_memory_gb']['avg']:.1f}GB avg, {summary['system_memory_gb']['max']:.1f}GB peak ({summary['system_memory_gb']['peak_usage_percent']:.1f}%)")
        print(f"   Ollama CPU: {summary['ollama_process']['cpu_avg']:.1f}% avg, {summary['ollama_process']['cpu_max']:.1f}% peak")
        print(f"   Ollama Memory: {summary['ollama_process']['memory_avg_mb']:.0f}MB avg, {summary['ollama_process']['memory_max_mb']:.0f}MB peak")
        print(f"   Available for larger model: ~{summary['estimated_available_memory_gb']:.1f}GB")
        print("\n🎯 Model Recommendations:")
        for rec in model_recommendations:
            print(f"   {rec}")
            
        return summary
    
    def save_detailed_data(self, filename="resource_monitoring.json"):
        """Save detailed monitoring data"""
        with open(filename, 'w') as f:
            json.dump(self.data, f, indent=2)
        print(f"💾 Detailed data saved to: {filename}")

def monitor_llm_analysis():
    """Monitor resource usage during LLM analysis"""
    monitor = ResourceMonitor()
    
    print("🚀 Starting resource monitoring for LLM analysis...")
    print("   Run your analysis command in another terminal")
    print("   Press Ctrl+C to stop monitoring\n")
    
    monitor.start_monitoring(interval=1.0)
    
    try:
        # Keep monitoring until interrupted
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Stopping monitoring...")
        summary = monitor.stop_monitoring()
        monitor.save_detailed_data()
        return summary

if __name__ == "__main__":
    monitor_llm_analysis()