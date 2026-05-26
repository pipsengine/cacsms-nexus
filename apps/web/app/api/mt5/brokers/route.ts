import { failure, ok } from "../_lib/http";
import { INFRASTRUCTURE_REGISTRATION_MODULE_KEYS, withMt5Module, withMt5Modules } from "../_lib/ensure-ready";
import { getRole, registerBroker, type BrokerRegistrationInput } from "../_lib/store";
import { provisionBrokerConnectionFromRegistration } from "../broker-connections/_lib/store";

export async function GET() {
  const { getBrokers } = await import("../_lib/store");
  return ok(await withMt5Module("mt5-control-center", () => getBrokers()));
}

export async function POST(request: Request) {
  try {
    return await withMt5Modules(INFRASTRUCTURE_REGISTRATION_MODULE_KEYS, async () => {
      const body = await request.json() as BrokerRegistrationInput;
      const role = getRole(request);
      const broker = registerBroker(body, role, request);
      provisionBrokerConnectionFromRegistration(broker, role, request);
      return ok(broker, 201);
    });
  } catch (error) {
    return failure(error);
  }
}
