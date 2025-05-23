// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import appRoutes from "./routes/appRoutes";

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {appRoutes.map(({ path, element }, index) => (
            <Route key={index} path={path} element={element} />
          ))}
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
