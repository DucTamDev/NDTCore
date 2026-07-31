// __tests__/App.test.tsx
import React from 'react';
import TestRenderer from 'react-test-renderer';
import App from '../App';

it('renders without crashing', () => {
  TestRenderer.act(() => {
    TestRenderer.create(<App />);
  });
});
