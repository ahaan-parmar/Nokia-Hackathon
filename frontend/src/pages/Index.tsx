import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Network, BarChart3, Zap, ArrowRight, Radio, Cpu, Database } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background grid-pattern relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="relative z-10">
        {/* Header */}
        <header className="container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 glow-primary">
              <Network className="w-6 h-6 text-primary" />
            </div>
            <span className="font-semibold text-lg text-foreground">Fronthaul Analyzer</span>
          </div>
          <Link to="/analysis">
            <Button variant="outline" className="border-primary/30 hover:border-primary hover:bg-primary/10 text-primary">
              Launch Analysis
            </Button>
          </Link>
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-6 py-20">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-primary">Network Topology Intelligence</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Fronthaul Topology
              <span className="block text-primary">Identification</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
              Analyze traffic patterns and packet-loss behavior across 24 radio cells to infer 
              hidden fronthaul topology and identify shared physical Ethernet links.
            </p>

            <Link to="/analysis">
              <Button 
                size="lg" 
                className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary px-8 py-6 text-lg group"
              >
                Analyze Fronthaul Logs
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          {/* Architecture Diagram */}
          <div className="mt-24 max-w-5xl mx-auto">
            <h2 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
              System Architecture
            </h2>
            
            <div className="glass rounded-2xl p-8 relative">
              <div className="grid md:grid-cols-5 gap-4 items-center">
                {/* Radio Cells */}
                <div className="md:col-span-2 space-y-4">
                  <div className="text-sm font-medium text-muted-foreground mb-4 text-center">24 Radio Cells</div>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`p-3 rounded-lg flex items-center justify-center ${
                          i < 2 ? 'bg-link-1/20 border border-link-1/30' :
                          i < 4 ? 'bg-link-2/20 border border-link-2/30' :
                          i < 6 ? 'bg-link-3/20 border border-link-3/30' :
                          'bg-link-4/20 border border-link-4/30'
                        }`}
                      >
                        <Radio className={`w-4 h-4 ${
                          i < 2 ? 'text-link-1' :
                          i < 4 ? 'text-link-2' :
                          i < 6 ? 'text-link-3' :
                          'text-link-4'
                        }`} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fronthaul Links */}
                <div className="flex flex-col items-center gap-3">
                  <div className="text-sm font-medium text-muted-foreground">Fronthaul</div>
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3, 4].map((link) => (
                      <div 
                        key={link}
                        className={`h-1 w-20 rounded-full ${
                          link === 1 ? 'bg-link-1' :
                          link === 2 ? 'bg-link-2' :
                          link === 3 ? 'bg-link-3' :
                          'bg-link-4'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">Shared Links</div>
                </div>

                {/* Processing Unit */}
                <div className="md:col-span-2 flex flex-col items-center">
                  <div className="text-sm font-medium text-muted-foreground mb-4">Central Processing</div>
                  <div className="p-6 rounded-xl bg-secondary border border-border flex flex-col items-center gap-3">
                    <div className="flex gap-3">
                      <div className="p-3 rounded-lg bg-background">
                        <Cpu className="w-6 h-6 text-primary" />
                      </div>
                      <div className="p-3 rounded-lg bg-background">
                        <Database className="w-6 h-6 text-accent" />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">Baseband Unit</span>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-8 pt-6 border-t border-border flex flex-wrap justify-center gap-6">
                {[
                  { color: 'bg-link-1', label: 'Link 1 (8 cells)' },
                  { color: 'bg-link-2', label: 'Link 2 (6 cells)' },
                  { color: 'bg-link-3', label: 'Link 3 (6 cells)' },
                  { color: 'bg-link-4', label: 'Link 4 (4 cells)' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="mt-24 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: Network,
                title: "Topology Mapping",
                description: "Identify which cells share physical fronthaul links through correlation analysis",
              },
              {
                icon: BarChart3,
                title: "Traffic Analysis",
                description: "Visualize traffic patterns and congestion behavior across all links",
              },
              {
                icon: Zap,
                title: "Capacity Planning",
                description: "Calculate required bandwidth with and without buffer optimization",
              },
            ].map((feature, i) => (
              <div 
                key={feature.title}
                className="glass rounded-xl p-6 hover:border-primary/30 transition-colors"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Why This Matters */}
          <div className="mt-24 max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-foreground mb-6">Why This Matters</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { label: "Congestion Understanding", value: "Root Cause" },
                { label: "Link Optimization", value: "Capacity" },
                { label: "Network Reliability", value: "Performance" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="text-3xl font-bold text-primary mb-2">{item.value}</div>
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-8 border-t border-border mt-20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>Fronthaul Topology Identification System</span>
            <span>Data-driven network analysis</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
