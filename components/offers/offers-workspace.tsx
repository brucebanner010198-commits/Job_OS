"use client";

import { useState } from "react";
import { Plus, Trash2, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface OfferItem {
  id: string;
  company: string;
  role: string;
  baseSalary: number;
  bonus: number;
  equityPerYear: number;
  signOnBonus: number;
  remotePolicy: string;
  cultureRating: number; // 1 to 5
}

export function OffersWorkspace() {
  const [offers, setOffers] = useState<OfferItem[]>([
    {
      id: "1",
      company: "Acme Cloud",
      role: "Senior Fullstack Engineer",
      baseSalary: 165000,
      bonus: 16500,
      equityPerYear: 35000,
      signOnBonus: 10000,
      remotePolicy: "Fully Remote",
      cultureRating: 4,
    },
    {
      id: "2",
      company: "Starlight Data",
      role: "Lead Platform Engineer",
      baseSalary: 180000,
      bonus: 20000,
      equityPerYear: 45000,
      signOnBonus: 15000,
      remotePolicy: "Hybrid (2 days/wk)",
      cultureRating: 4,
    },
  ]);

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [bonus, setBonus] = useState("");
  const [equityPerYear, setEquityPerYear] = useState("");
  const [signOnBonus, setSignOnBonus] = useState("");
  const [remotePolicy, setRemotePolicy] = useState("Fully Remote");

  const handleAddOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !baseSalary) return;

    setOffers([
      ...offers,
      {
        id: String(Date.now()),
        company,
        role: role || "Software Engineer",
        baseSalary: Number(baseSalary) || 0,
        bonus: Number(bonus) || 0,
        equityPerYear: Number(equityPerYear) || 0,
        signOnBonus: Number(signOnBonus) || 0,
        remotePolicy,
        cultureRating: 4,
      },
    ]);

    setCompany("");
    setRole("");
    setBaseSalary("");
    setBonus("");
    setEquityPerYear("");
    setSignOnBonus("");
  };

  const removeOffer = (id: string) => {
    setOffers(offers.filter((o) => o.id !== id));
  };

  const calculateTotalComp = (o: OfferItem) => {
    return o.baseSalary + o.bonus + o.equityPerYear;
  };

  return (
    <div className="space-y-8">
      {/* Side-by-side comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="h-5 w-5 text-accent" />
            Active offer comparison matrix
          </CardTitle>
          <CardDescription>
            Compare competing job offers across base salary, annual equity, performance bonuses, and work flexibility.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No offers recorded yet. Add your received offers below to compare total compensation.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-3 px-4">Offer / Company</th>
                    <th className="py-3 px-4">Base Salary</th>
                    <th className="py-3 px-4">Annual Bonus</th>
                    <th className="py-3 px-4">Equity / Year</th>
                    <th className="py-3 px-4">Signing Bonus</th>
                    <th className="py-3 px-4">Annual Total Comp</th>
                    <th className="py-3 px-4">Work Policy</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {offers.map((offer) => {
                    const totalComp = calculateTotalComp(offer);
                    return (
                      <tr key={offer.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium">
                          <div>{offer.company}</div>
                          <div className="text-xs text-muted-foreground">{offer.role}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium">
                          ${offer.baseSalary.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          ${offer.bonus.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          ${offer.equityPerYear.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          ${offer.signOnBonus.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-500">
                          ${totalComp.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {offer.remotePolicy}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => removeOffer(offer.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded"
                            title="Remove offer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add new offer form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-accent" />
            Add new offer for evaluation
          </CardTitle>
          <CardDescription>
            Enter components from an offer letter or recruiter phone screen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddOffer} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Company</label>
              <Input
                placeholder="e.g. Stripe"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Role Title</label>
              <Input
                placeholder="e.g. Senior Backend Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Annual Base Salary ($)</label>
              <Input
                type="number"
                placeholder="175000"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Annual Bonus ($)</label>
              <Input
                type="number"
                placeholder="15000"
                value={bonus}
                onChange={(e) => setBonus(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Equity Value / Year ($)</label>
              <Input
                type="number"
                placeholder="40000"
                value={equityPerYear}
                onChange={(e) => setEquityPerYear(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sign-on Bonus ($)</label>
              <Input
                type="number"
                placeholder="10000"
                value={signOnBonus}
                onChange={(e) => setSignOnBonus(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Work Policy</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={remotePolicy}
                onChange={(e) => setRemotePolicy(e.target.value)}
              >
                <option value="Fully Remote">Fully Remote</option>
                <option value="Hybrid (1-2 days/wk)">Hybrid (1-2 days/week)</option>
                <option value="Hybrid (3-4 days/wk)">Hybrid (3-4 days/week)</option>
                <option value="On-site">On-site</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Add offer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
