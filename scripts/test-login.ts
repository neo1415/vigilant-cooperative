/**
 * Test login script to verify authentication flow
 */

import { config } from 'dotenv';
config();

async function testLogin() {
  console.log('🔍 Testing login flow...\n');

  try {
    // Test login
    const loginResponse = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: 'VIG-2026-001',
        password: 'Admin123!',
      }),
    });

    console.log('📡 Login Response Status:', loginResponse.status);
    const loginData = await loginResponse.json();
    console.log('📦 Login Response:', JSON.stringify(loginData, null, 2));

    if (!loginData.success) {
      console.error('❌ Login failed:', loginData.error);
      return;
    }

    const token = loginData.data.accessToken;
    console.log('\n✅ Login successful!');
    console.log('🔑 Token:', token.substring(0, 50) + '...');

    // Test fetching savings accounts
    console.log('\n🔍 Testing savings accounts fetch...');
    const savingsResponse = await fetch('http://localhost:3001/api/v1/savings/accounts', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log('📡 Savings Response Status:', savingsResponse.status);
    const savingsData = await savingsResponse.json();
    console.log('📦 Savings Response:', JSON.stringify(savingsData, null, 2));

    // Test fetching loans
    console.log('\n🔍 Testing loans fetch...');
    const loansResponse = await fetch('http://localhost:3001/api/v1/loans', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log('📡 Loans Response Status:', loansResponse.status);
    const loansData = await loansResponse.json();
    console.log('📦 Loans Response:', JSON.stringify(loansData, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLogin();
