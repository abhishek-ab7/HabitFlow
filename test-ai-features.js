#!/usr/bin/env node

/**
 * Comprehensive AI Features Test Suite
 * Tests all AI endpoints with realistic data
 */

const API_BASE = 'http://localhost:3000/api/ai';

// Helper function to make requests
async function testEndpoint(name, endpoint, payload) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log('━'.repeat(60));
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-123'
      },
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    if (!response.ok) {
      console.log(`❌ FAILED (${response.status}) - ${duration}ms`);
      console.log('Error:', data.error);
      console.log('Details:', data.details);
      return { success: false, duration, error: data };
    }

    console.log(`✅ SUCCESS - ${duration}ms`);
    console.log('Response:', JSON.stringify(data, null, 2));
    return { success: true, duration, data };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ NETWORK ERROR - ${duration}ms`);
    console.log('Error:', error.message);
    return { success: false, duration, error: error.message };
  }
}

// Test data
const mockUserData = {
  userId: 'test-user-123',
  userName: 'Alex',
  level: 8,
  xp: 750
};

const mockTask = {
  id: 'task-123',
  title: 'Design landing page mockups',
  description: 'Create high-fidelity mockups for the new SaaS product landing page',
  due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
  priority: 'medium',
  tags: ['design', 'marketing']
};

const mockGoals = [
  {
    id: 'goal-1',
    title: 'Launch MVP by March',
    description: 'Build and ship the minimum viable product',
    areaOfLife: 'career'
  },
  {
    id: 'goal-2',
    title: 'Run a 5K',
    description: 'Complete a 5K run without stopping',
    areaOfLife: 'health'
  }
];

const mockHabits = [
  { id: 'habit-1', name: 'Morning workout', category: 'health' },
  { id: 'habit-2', name: 'Code for 2 hours', category: 'work' },
  { id: 'habit-3', name: 'Read before bed', category: 'learning' }
];

const mockBurnoutData = {
  completionRates: {
    last7Days: 45.5,
    last30Days: 72.3,
    previous7Days: 85.2
  },
  streakData: [
    { habitName: 'Morning workout', currentStreak: 12, consecutiveSkips: 3 },
    { habitName: 'Code for 2 hours', currentStreak: 5, consecutiveSkips: 0 },
    { habitName: 'Read before bed', currentStreak: 0, consecutiveSkips: 4 }
  ],
  taskVelocity: {
    current: 8,
    baseline: 15
  },
  xpGainRate: {
    current: 120,
    baseline: 200
  }
};

// Main test suite
async function runTests() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║      HABITFLOW AI FEATURES - COMPREHENSIVE TEST SUITE      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  const results = [];

  // Test 1: AI Coach Briefing
  results.push(await testEndpoint(
    '1. AI Coach Briefing',
    '/coach',
    {
      userData: mockUserData,
      context: {
        unfinishedTasks: 5,
        todaysHabits: 'Morning workout, Code session',
        mode: 'briefing'
      }
    }
  ));

  await sleep(2000); // Rate limit protection

  // Test 2: Task Prioritization
  results.push(await testEndpoint(
    '2. Smart Task Prioritization',
    '/prioritize-task',
    {
      task: mockTask,
      userContext: {
        activeGoals: mockGoals,
        currentTime: new Date().toLocaleString(),
        weekdayStats: 75
      }
    }
  ));

  await sleep(2000);

  // Test 3: Habit Recommendations
  results.push(await testEndpoint(
    '3. Habit Recommendations',
    '/recommend-habits',
    {
      goals: mockGoals,
      currentHabits: mockHabits,
      categoryPerformance: {
        health: 80,
        work: 90,
        learning: 60
      },
      userLevel: mockUserData.level
    }
  ));

  await sleep(2000);

  // Test 4: Burnout Detection
  results.push(await testEndpoint(
    '4. Burnout Detection',
    '/burnout-check',
    mockBurnoutData
  ));

  await sleep(2000);

  // Test 5: Subtask Generation
  results.push(await testEndpoint(
    '5. Subtask Generation',
    '/generate-subtasks',
    {
      title: 'Build user authentication system',
      description: 'Implement secure login, signup, and password reset functionality'
    }
  ));

  await sleep(2000);

  // Test 6: Cache Hit Test (repeat coach briefing)
  console.log('\n🔄 Testing Cache (repeating AI Coach request)');
  results.push(await testEndpoint(
    '6. AI Coach (Cache Hit Test)',
    '/coach',
    {
      userData: mockUserData,
      context: {
        unfinishedTasks: 5,
        todaysHabits: 'Morning workout, Code session',
        mode: 'briefing'
      }
    }
  ));

  // Summary
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                       TEST SUMMARY                         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✅ Passed: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Average Response Time: ${avgDuration.toFixed(0)}ms`);
  console.log(`🎯 Success Rate: ${(successful / results.length * 100).toFixed(1)}%`);

  // Performance breakdown
  console.log('\n📊 Performance Breakdown:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const name = `Test ${index + 1}`;
    console.log(`  ${status} ${name}: ${result.duration}ms`);
  });

  if (successful === results.length) {
    console.log('\n🎉 ALL TESTS PASSED! 🎉\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED\n');
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});
