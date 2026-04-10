import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Branch {
  id: string;
  name: string;
  isDefault: boolean;
}

interface BranchState {
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch | null) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      currentBranch: null,
      setCurrentBranch: (branch) => {
        if (branch) {
          localStorage.setItem("currentBranchId", branch.id);
        } else {
          localStorage.removeItem("currentBranchId");
        }
        set({ currentBranch: branch });
      },
    }),
    { name: "branch-storage" }
  )
);
