import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// мокируем контекст авторизации
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn().mockResolvedValue(true),
    register: jest.fn().mockResolvedValue(true),
    loading: false,
    error: null,
  }),
}));

// мокируем навигацию
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

import LoginForm from '../components/LoginForm';

test('отрисовка формы входа и отправка', async () => {
  render(<LoginForm />);

  const username = screen.getByPlaceholderText(/Введите имя/i);
  const password = screen.getByPlaceholderText(/Введите пароль/i);
  const btn = screen.getByRole('button', { name: /^войти$/i });

  // заполнить форму
  fireEvent.change(username, { target: { value: 'testuser' } });
  fireEvent.change(password, { target: { value: 'pass' } });

  // отправить форму
  fireEvent.click(btn);

  // навигация происходит после успешного входа
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
});
