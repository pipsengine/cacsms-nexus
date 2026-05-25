import { ok } from "../../_lib/http";
import { brokerConnections } from "../_lib/store";
import { rankBrokerReliability } from "@/modules/mt5-infrastructure-and-broker-connectivity/broker-connections/algorithms/broker-connections.algorithms";

export function GET() { return ok(rankBrokerReliability(brokerConnections())); }
