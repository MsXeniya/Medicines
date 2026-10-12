import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// мокируем контекст с администратором
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'admin', role: 'admin' } }),
}));

import RoleRoute from '../components/RoleRoute';

test('отрисовка дочерних элементов при разрешённой роли', () => {
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<RoleRoute roles={["admin"]}><div>Secret</div></RoleRoute>} />
      </Routes>
    </MemoryRouter>
  );

  // при роли admin должен отрисоваться защищённый контент
  expect(screen.getByText(/Secret/)).toBeInTheDocument();
});
