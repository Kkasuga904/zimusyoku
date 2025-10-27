import { NavLink, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import JobDetail from "./pages/JobDetail";
import Jobs from "./pages/Jobs";
import Upload from "./pages/Upload";

const App = () => {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>Zimusyoku Console</h1>
        <nav>
          <ul className="nav-links">
            <li>
              <NavLink to="/" end>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/jobs">Jobs</NavLink>
            </li>
            <li>
              <NavLink to="/upload">Upload</NavLink>
            </li>
          </ul>
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/upload" element={<Upload />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
