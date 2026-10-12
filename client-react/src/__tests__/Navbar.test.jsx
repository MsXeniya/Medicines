import React from 'react';
import { render, screen } from '@testing-library/react';

// мокируем logout
const mockLogout = jest.fn();

// мокируем контекст авторизации с авторизованным пользователем
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'xenia', role: 'user' },
    logout: mockLogout,
  }),
}));

import { MemoryRouter } from 'react-router-dom';
import Navbar from '../components/Navbar';

test('отрисовка информации пользователя в навбаре', () => {
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  );

  // проверить наличие имени пользователя и ссылки на профиль
  expect(screen.getByText(/xenia/i)).toBeInTheDocument();
  expect(screen.getByText(/Профиль/i)).toBeInTheDocument();
});
