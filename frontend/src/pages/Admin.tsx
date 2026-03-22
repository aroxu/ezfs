import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Input, Button, Divider } from "@heroui/react";
import { login } from "../utils/api";
import axios from "../utils/api";
import { useNavigate } from "react-router-dom";
import { Lock, User, LogIn, AlertCircle } from "lucide-react";
import { AxiosError } from "axios";

const Admin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [countDown, setCountDown] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockUntil !== null) {
      const updateCountDown = () => {
        const now = Date.now();
        const diff = Math.ceil((lockUntil - now) / 1000);
        if (diff <= 0) {
          setLockUntil(null);
          setCountDown(null);
          setError("");
        } else {
          setCountDown(diff);
        }
      };

      updateCountDown();
      timer = setInterval(updateCountDown, 1000);
    }
    return () => clearInterval(timer);
  }, [lockUntil]);

  const getErrorMessage = () => {
    if (countDown !== null) {
      const h = Math.floor(countDown / 3600);
      const m = Math.floor((countDown % 3600) / 60);
      const s = countDown % 60;

      let timeStr = "";
      if (h > 0) timeStr = `${h}h ${m}m ${s}s`;
      else if (m > 0) timeStr = `${m}m ${s}s`;
      else timeStr = `${s}s`;

      if (error.includes("locked for") || error.includes("Try again in")) {
        return error.replace(/(locked for|Try again in) .*/, `$1 ${timeStr}`);
      }
    }
    return error;
  };

  useEffect(() => {
    document.title = "ezfs - Admin Login";
    // Check if already logged in by pinging status
    const checkAuth = async () => {
      try {
        await axios.get("/admin/status");
        navigate("/admin/dashboard");
      } catch {
        // Not logged in, stay here
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogin = async () => {
    setError("");
    setLockUntil(null);
    setCountDown(null);
    setIsLoading(true);
    try {
      await login(username, password);
      navigate("/admin/dashboard");
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: string; lock_until?: number }>;
      const msg = axiosErr.response?.data?.error || "Login failed. Please check your credentials.";
      const until = axiosErr.response?.data?.lock_until;

      if (until) {
        setLockUntil(until);
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-[70vh]">
      <Card className="w-full max-w-100 bg-background/60 border border-divider shadow-2xl" isBlurred>
        <CardHeader className="flex flex-col gap-1 p-6 items-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
            <Lock size={24} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Private Portal</h2>
          <p className="text-default-500 text-small">Private access to your files</p>
        </CardHeader>
        <Divider className="opacity-50" />
        <CardBody className="gap-5 p-6">
          {error && (
            <div className="bg-danger-50 border border-danger-200 text-danger-600 px-4 py-3 rounded-lg flex items-center gap-2 text-small animate-pulse-slow">
              <AlertCircle size={16} />
              {getErrorMessage()}
            </div>
          )}
          <div className="flex flex-col gap-4">
            <Input
              label="Username"
              variant="bordered"
              labelPlacement="outside"
              placeholder="Enter your username"
              startContent={<User size={18} className="text-default-400" />}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              variant="bordered"
              labelPlacement="outside"
              placeholder="Enter your password"
              startContent={<Lock size={18} className="text-default-400" />}
              value={password}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button
            color="primary"
            size="lg"
            className="w-full font-bold shadow-lg shadow-primary/20 mt-2"
            isLoading={isLoading}
            isDisabled={countDown !== null || error.includes("permanently locked")}
            onPress={handleLogin}
            startContent={!isLoading && <LogIn size={20} />}
          >
            Sign In
          </Button>
        </CardBody>
      </Card>
    </div>
  );
};

export default Admin;
