import { Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import ShareView from "./pages/ShareView";
import NotFound from "./pages/NotFound";
import AppNavbar from "./components/Navbar";

function App() {
  const location = useLocation();
  const validPaths = ["/admin", "/admin/dashboard"];
  const isPublic = !validPaths.some((path) => location.pathname === path || location.pathname.startsWith(path));

  return (
    <>
      {!isPublic && <AppNavbar />}
      <div className={`mx-auto px-4 md:px-10 w-full max-w-[1600px] ${!isPublic ? "py-10" : "py-6 md:py-12"}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/s/:id" element={<ShareView />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
