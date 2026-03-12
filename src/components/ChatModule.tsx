import GlobalChatBox from "@/components/GlobalChatBox";
import OnlineUsersPanel from "@/components/OnlineUsersPanel";

const ChatModule = () => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 items-start">
        <GlobalChatBox />
        <OnlineUsersPanel />
      </div>
    </div>
  );
};

export default ChatModule;
