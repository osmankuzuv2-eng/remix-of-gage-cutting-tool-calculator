import GlobalChatBox from "@/components/GlobalChatBox";
import OnlineUsersPanel from "@/components/OnlineUsersPanel";
import IzmirWeather from "@/components/IzmirWeather";

const HomePage = () => {
  return (
    <div className="space-y-4">
      {/* Top row: Chat (left) + Online Users (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
        <GlobalChatBox />
        <OnlineUsersPanel />
      </div>

      {/* Bottom: İzmir 5-day weather */}
      <IzmirWeather />
    </div>
  );
};

export default HomePage;
