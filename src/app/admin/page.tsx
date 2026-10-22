"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import SectionCard from "@/components/SectionCard";
import ReportList from "@/components/ReportList";
import EventFormDialog from "@/components/EventFormDialog";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { dashboardReportColumns } from "@/components/reportColumns";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { monthBounds } from "@/lib/formatting";
import { countReports, listReports } from "@/lib/data/reports";
import { countEventsInRange } from "@/lib/data/events";
import { countActiveStaff } from "@/lib/data/profiles";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  // Computed inside the fetcher so it's fresh on every reload (e.g. after
  // creating an event, or when the month rolls over).
  const { data, loading, error, load } = useData(async () => {
    const bounds = monthBounds(new Date());
    const [total, pending, eventsThisMonth, activeStaff, recent] = await Promise.all([
      countReports(),
      countReports("submitted"),
      countEventsInRange(bounds.start, bounds.end),
      countActiveStaff(),
      listReports({ limit: 8 }),
    ]);
    return { total, pending, eventsThisMonth, activeStaff, recent };
  }, []);

  const firstName = (user?.full_name || "Admin").split(" ")[0];

  return (
    <div>
      <PageHeader title={`Good day, ${firstName}`} description="Here's how charting is going today." />

      {!data && loading ? (
        <LoadingState />
      ) : !data ? (
        <EmptyState title="Couldn't load the dashboard" description={error ?? "Please try again."} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Total Reports" value={data.total} />
            <StatCard
              label="Reports Pending Verification"
              value={data.pending}
              tone={data.pending > 0 ? "warning" : "default"}
              hint={data.pending > 0 ? "Waiting on a Team Leader review" : "All caught up"}
            />
            <StatCard label="Active Users" value={data.activeStaff} hint="Team Leaders + Charters" />
            <StatCard label="Events This Month" value={data.eventsThisMonth} />
          </div>

          <SectionCard
            title="Recent Submissions"
            subtitle="The latest patient reports across every event"
            contentClassName="p-0"
          >
            <ReportList
              reports={data.recent}
              columns={dashboardReportColumns()}
              onOpen={(report) => router.push(`/admin/reports/${report.id}`)}
            />
          </SectionCard>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/reports">
                <CalendarPlus className="mr-2 h-4 w-4" />
                View All Reports
              </Link>
            </Button>
          </div>
        </div>
      )}

      <EventFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />
    </div>
  );
}
