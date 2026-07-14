import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/AuthGuard";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import PhoneNumbers from "./pages/PhoneNumbers.tsx";
import Auth from "./pages/Auth.tsx";
import ProfileSetup from "./pages/ProfileSetup.tsx";
import Marketplace from "./pages/Marketplace.tsx";
import Listing from "./pages/Listing.tsx";
import SellerDashboard from "./pages/SellerDashboard.tsx";
import FarmerToolkit from "./pages/FarmerToolkit.tsx";
import AgentDashboard from "./pages/AgentDashboard.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup" element={<AuthGuard requireOnboarded={false}><ProfileSetup /></AuthGuard>} />
            <Route path="/" element={<Index />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/listing/:id" element={<Listing />} />
            <Route path="/seller" element={<AuthGuard><SellerDashboard /></AuthGuard>} />
            <Route path="/toolkit" element={<AuthGuard><FarmerToolkit /></AuthGuard>} />
            <Route path="/agents" element={<AuthGuard><AgentDashboard /></AuthGuard>} />
            <Route path="/phone-numbers" element={<PhoneNumbers />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
