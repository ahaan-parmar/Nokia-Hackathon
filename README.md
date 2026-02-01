# Intelligent Fronthaul Network Analyzer  
**Team: Phish & Chips**

A data-driven system to **identify fronthaul network topology** and **estimate optimal Ethernet link capacity** using historical O-RAN fronthaul traffic logs.

This project was built for the **Intelligent Fronthaul Network Optimization** hackathon challenge and addresses **all expected deliverables** defined in the problem statement.

---

## Problem Overview

In O-RAN fronthaul TSN networks, multiple radio cells may share Ethernet links between the DU and RU.  
During congestion, cells on the same link exhibit **correlated traffic spikes and packet loss**.

The challenge is to:
- Infer which cells share the same fronthaul links
- Visualize the inferred topology
- Estimate the **minimum required link capacity**
  - without buffering
  - with buffering (4 symbols, 1 percent packet loss tolerance)

All analysis is based purely on **historical throughput and packet statistics logs**.

---

## What This Project Delivers

### 1. Network Topology Identification  
**Status: Complete**

- Cells are grouped into shared fronthaul links using **correlation of congestion and packet loss events**
- Supports partial prior knowledge (for example, Cell1 is on Link2)
- Identifies both:
  - shared links
  - isolated cells on dedicated links

**Output**
- Cell → Link mapping (Link 1, Link 2, Link 3 and beyond)
- Interactive topology graph:
  - BBU at center
  - Links in middle ring
  - Cells on outer ring

---

### 2. Correlation-Based Congestion Analysis (Figure 1 equivalent)  
**Status: Complete**

- Correlation heatmap showing synchronized congestion behavior
- Cells sharing the same link form visible high-correlation blocks
- Used directly for topology inference

This satisfies the requirement for **traffic pattern snapshots used to identify shared links**.

---

### 3. Symbol-to-Slot Conversion  
**Status: Complete**

Traffic logs are provided at **symbol level** and are converted as follows:

- 1 slot = 14 symbols = 500 microseconds
- Slot index = floor(symbol_index / 14)

This conversion is used consistently across all traffic and capacity analysis.

---

### 4. Per-Slot Traffic Analysis (Figure 3 equivalent)  
**Status: Complete**

- Aggregated traffic per inferred fronthaul link
- Time resolution: 1 slot
- Window length: 60 seconds
- Data rate shown in Gbps
- Average vs peak traffic clearly visualized

This directly matches the expected Figure 3 output.

---

### 5. Link Capacity Estimation  
**Status: Complete**

Capacity is estimated for each inferred fronthaul link in two scenarios.

#### Case A: Without Buffer
- No buffering allowed
- Required capacity = maximum observed traffic per slot

Formula:
C_no_buffer = max(traffic_per_slot)

---

#### Case B: With Buffer (4 symbols, 1 percent loss)
- Buffer size = 4 symbols = 143 microseconds
- Packet loss allowed in up to 1 percent of traffic-carrying slots
- FIFO buffer simulation with binary search to find minimum safe capacity

Buffer size in bits:
buffer_bits = capacity_bits_per_slot × (4 / 14)

This approach balances burst absorption with acceptable packet loss, producing **15–20 percent capacity savings** compared to no-buffer provisioning.

---

### 6. Buffer Impact Analysis  
**Status: Complete**

- Clear comparison of capacity:
  - with buffer
  - without buffer
- Per-link and total capacity savings shown
- Final summary table aggregates results across all links

---

### 7. ML-Based Congestion Prediction (Bonus)  
**Status: Complete**

- Machine learning model predicts congestion risk ahead of time
- Not required by the problem statement, but included to improve innovation and real-world applicability

---

## Dashboard Structure (Deliverable-Oriented)

The UI is ordered to match the expected outcomes:

1. Network topology visualization  
2. Inferred topology insights  
3. ML congestion prediction  
4. Topology mapping and correlation heatmap  
5. Cell-wise traffic analysis  
6. Aggregated link traffic  
7. Per-slot link traffic (Figure 3)  
8. Buffer impact analysis  
9. Final summary table  

This allows judges to verify each requirement **step by step**.

---

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn-ui
- Recharts and custom D3-based visualizations

### Backend and Analysis
- Python
- Pandas and NumPy
- Custom buffer simulation and capacity estimation logic
- Correlation-based topology inference

---

## Running the Project Locally

### Prerequisites
- Node.js (18 or later)
- npm

### Steps

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start the development server
npm run dev

The application will be available at:
http://localhost:5173
