import { createHashRouter, RouterProvider } from 'react-router-dom';
import ShelterBrowser from './routes/ShelterBrowser';

const router = createHashRouter(
  [
    {
      path: '/',
      element: <ShelterBrowser />,
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
);

export default function App() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
