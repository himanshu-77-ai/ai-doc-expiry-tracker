import React from "react";
import { cn } from "../lib/utils";
import { Document } from "../types";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
}

export function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-gray-500 text-sm font-medium">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </div>
      <div className="p-3 bg-gray-50 rounded-xl">
        {icon}
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status: Document['status'];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    'Safe': "bg-green-50 text-green-700 border-green-100",
    'Renewed': "bg-emerald-50 text-emerald-700 border-emerald-100",
    'Expiring Soon': "bg-amber-50 text-amber-700 border-amber-100",
    'Expired': "bg-red-50 text-red-700 border-red-100",
  };

  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider", styles[status])}>
      {status}
    </span>
  );
}
