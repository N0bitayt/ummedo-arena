import React from 'react';
import { render, screen } from '@testing-library/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';

test('renders the arena dashboard', () => {
  render(<GoogleOAuthProvider clientId="test-client-id"><App /></GoogleOAuthProvider>);
  expect(screen.getByText('UMMEDO')).toBeInTheDocument();
  expect(screen.getByText('Dashboard')).toBeInTheDocument();
});
