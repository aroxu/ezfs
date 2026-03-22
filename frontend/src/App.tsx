import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Spinner } from "@heroui/react";
import AppNavbar from "./components/Navbar";

const Home = lazy(() => import("./pages/Home"));
const Admin = lazy(() => import("./pages/Admin"));
const ShareView = lazy(() => import("./pages/ShareView"));

function App() {
  const location = useLocation();
  const isPublic = !location.pathname.startsWith("/private");

  return (
    <>
      {!isPublic && <AppNavbar />}
      <div className={`mx-auto px-4 md:px-10 w-full max-w-400 overflow-hidden ${!isPublic ? "py-10" : "py-6 md:py-12"}`}>
        <Suspense fallback={<div className="flex justify-center items-center h-[60vh]"><Spinner size="lg" /></div>}>
          <Routes>
            <Route path="/private/*" element={<Admin />} />
            <Route path="/s/:id/*" element={<ShareView />} />
            <Route path="/*" element={<Home />} />
          </Routes>
        </Suspense>
      </div>
    </>
  );
}

export default App;
