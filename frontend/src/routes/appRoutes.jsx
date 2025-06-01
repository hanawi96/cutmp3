// src/routes/appRoutes.jsx
import Home from "../pages/Home";
import Mp3Cutter from "../apps/mp3-cutter";

const appRoutes = [
  { path: "/", element: <Home /> },
  { path: "/mp3-cutter", element: <Mp3Cutter /> },
];

export default appRoutes;
