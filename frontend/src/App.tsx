import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Spinner } from "@heroui/react";
import AppNavbar from "./components/Navbar";

const Home = lazy(() => import("./pages/Home"));
const Admin = lazy(() => import("./pages/Admin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ShareView = lazy(() => import("./pages/ShareView"));
const NotFound = lazy(() => import("./pages/NotFound"));

function App() {
  const location = useLocation();
  const validPaths = ["/admin", "/admin/dashboard"];
  const isPublic = !validPaths.some((path) => location.pathname === path || location.pathname.startsWith(path));

  return (
    <>
      {!isPublic && <AppNavbar />}
      <div className={`mx-auto px-4 md:px-10 w-full max-w-400 ${!isPublic ? "py-10" : "py-6 md:py-12"}`}>
        <Suspense fallback={<div className="flex justify-center items-center h-[60vh]"><Spinner size="lg" /></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/s/:id" element={<ShareView />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </>
  );
}

export default App;
