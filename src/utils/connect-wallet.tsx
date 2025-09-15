import { Wallet } from "lucide-react";
import { Button } from "../ui";

export default function ConnectButton() {
    return <Button
        size="large"
        variant="destructive-primary"
        icon={<Wallet size={20} />}
        className="px-8 py-6 shadow-lg bg-[#262626] hover:shadow-xl transition-all duration-300"
    >
        <appkit-button  balance={"show"} />
    </Button>
}