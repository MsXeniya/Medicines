import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// мокируем контекст авторизации
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 2, username: 'user', role: 'user', permissions: ['medicines:read'] },
    hasPermission: (p) => p === 'medicines:create' ? false : true, // обычный пользователь не может создавать
  }),
}));

// мокируем fetch, т.к. utils/api строится поверх него
beforeEach(() => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      items: [{ id: 1, name: 'A', time: '08:00', taken: false, files: [] }],
      total: 1,
      totalPages: 1,
    }),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

import { MemoryRouter } from 'react-router-dom';
import MedicineList from '../components/MedicineList';

test('отрисовка лекарств из API', async () => {
  render(
    <MemoryRouter>
      <MedicineList />
    </MemoryRouter>
  );

  // дождаться загрузки списка лекарств
  await waitFor(() => expect(screen.getByText(/^A$/)).toBeInTheDocument());
});
