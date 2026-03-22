import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Link as HeroLink, Button } from "@heroui/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FolderTree, LogOut } from "lucide-react";

import axios from "../utils/api";

const AppNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname.startsWith("/private");

  const handleLogout = async () => {
    try {
      await axios.post("/logout");
    } finally {
      navigate("/");
    }
  };

  return (
    <Navbar isBordered className="bg-background/70 backdrop-blur-md" maxWidth="full">
      <NavbarBrand>
        <Link to="/" className="flex items-center gap-2 ml-4">
          <div className="p-1.5 bg-primary rounded-lg text-primary-foreground">
            <FolderTree size={20} />
          </div>
          <p className="font-bold text-inherit text-xl tracking-tight">ezfs</p>
        </Link>
      </NavbarBrand>
      <NavbarContent className="hidden sm:flex gap-4" justify="center">
        <NavbarItem isActive={location.pathname === "/"}>
          <HeroLink as={Link} color={location.pathname === "/" ? "primary" : "foreground"} to="/">
            Public
          </HeroLink>
        </NavbarItem>
        <NavbarItem isActive={location.pathname.startsWith("/private")}>
          <HeroLink as={Link} color={location.pathname.startsWith("/private") ? "primary" : "foreground"} to="/private">
            Private
          </HeroLink>
        </NavbarItem>
      </NavbarContent>
      <NavbarContent justify="end">
        {isDashboard && (
          <NavbarItem>
            <Button
              color="danger"
              variant="flat"
              size="sm"
              className="font-bold mr-4"
              onPress={handleLogout}
              startContent={<LogOut size={16} />}
            >
              Logout
            </Button>
          </NavbarItem>
        )}
      </NavbarContent>
    </Navbar>
  );
};

export default AppNavbar;
