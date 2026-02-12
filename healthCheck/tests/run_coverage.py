#!/usr/bin/env python3
"""
Coverage analysis runner for health check lambda tests
"""

import sys
import os
import coverage

# Add the parent directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def run_coverage_analysis():
    """Run tests with coverage analysis"""
    
    # Initialize coverage
    cov = coverage.Coverage(
        source=['../'],  # Cover the parent directory (healthCheck)
        omit=[
            '*/tests/*',  # Exclude test files
            '*/venv/*',
            '*/__pycache__/*',
            '*/site-packages/*',
            '*/__init__.py'  # Exclude __init__.py files from coverage metrics
        ]
    )
    
    print("Running Health Check Lambda Tests with Coverage Analysis")
    print("-" * 60)
    
    # Start coverage measurement
    cov.start()
    
    try:
        # Import and run the basic tests
        from run_tests import run_basic_tests
        success = run_basic_tests()
        
        # Stop coverage measurement
        cov.stop()
        
        print("\n" + "-" * 60)
        print("COVERAGE REPORT")
        print("-" * 60)
        
        # Generate coverage report
        cov.report(show_missing=True)
        
        print("\n" + "-" * 60)
        print("COVERAGE SUMMARY")
        print("-" * 60)
        
        # Get coverage percentage
        total_coverage = cov.report(show_missing=False)
        
        if total_coverage >= 80:
            print(f"Excellent coverage: {total_coverage:.1f}%")
        elif total_coverage >= 60:
            print(f"Good coverage: {total_coverage:.1f}%")
        elif total_coverage >= 40:
            print(f"Fair coverage: {total_coverage:.1f}%")
        else:
            print(f"Poor coverage: {total_coverage:.1f}%")
            
        # Generate HTML report
        try:
            cov.html_report(directory='../coverage_html')
            print(f"HTML coverage report generated: ../coverage_html/index.html")
        except Exception as e:
            print(f"Note: Could not generate HTML report: {e}")
        
        return success and total_coverage
        
    except Exception as e:
        cov.stop()
        print(f"Coverage analysis failed: {e}")
        return False

if __name__ == "__main__":
    success = run_coverage_analysis()
    sys.exit(0 if success else 1)