import gageLogo from "@/assets/gage-logo-white.png";

const LoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <img
      src={gageLogo}
      alt="GAGE Confidence"
      className="w-20 h-20 object-contain animate-pulse-logo"
    />
  </div>
);

export { LoadingScreen };
