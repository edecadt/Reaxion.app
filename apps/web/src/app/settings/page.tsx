"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  disconnectService,
  getAbout,
  getOAuth2ConnectUrl,
  getServiceConnections,
  type AboutService,
  type ServiceConnection,
} from "../../lib/api";
import { getAuthToken } from "../../lib/auth";

type ServiceWithConnection = AboutService & {
  connection?: ServiceConnection;
  isConnected: boolean;
};

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceWithConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busyServiceId, setBusyServiceId] = useState<string | null>(null);

  useEffect(() => {
    setToken(getAuthToken());
  }, []);

  useEffect(() => {
    const success = searchParams.get("success");
    const errorParam = searchParams.get("error");
    const serviceId = searchParams.get("service");

    if (success === "true" && serviceId) {
      setSuccessMessage(
        `Successfully connected to ${serviceId.charAt(0).toUpperCase() + serviceId.slice(1)}!`,
      );
      router.replace("/settings");
      setTimeout(() => setSuccessMessage(null), 5000);
    } else if (errorParam) {
      setError(decodeURIComponent(errorParam));
      router.replace("/settings");
      setTimeout(() => setError(null), 5000);
    }
  }, [searchParams, router]);

  const loadData = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const [aboutData, connections] = await Promise.all([
        getAbout(token),
        getServiceConnections(token),
      ]);

      const connectionsMap = new Map(
        connections.map((conn) => [conn.serviceId, conn]),
      );

      const servicesWithConnections: ServiceWithConnection[] =
        aboutData.server.services
          .filter((service) => {
            const authType =
              typeof service.auth === "string"
                ? service.auth
                : (service.auth?.type ?? "none");
            return authType !== "none";
          })
          .map((service) => {
            const serviceKey = service.id || service.name;
            const connection = connectionsMap.get(serviceKey);
            return {
              ...service,
              connection,
              isConnected: !!connection,
            };
          });

      setServices(servicesWithConnections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleConnect = useCallback(
    async (serviceId: string) => {
      if (!token) return;

      setBusyServiceId(serviceId);
      setError(null);

      try {
        const response = await fetch(getOAuth2ConnectUrl(serviceId), {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          method: "GET",
        });

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          payload = await response.text();
        }

        if (!response.ok) {
          const message =
            (payload &&
            typeof payload === "object" &&
            "message" in (payload as Record<string, unknown>)
              ? String((payload as Record<string, unknown>).message)
              : typeof payload === "string"
                ? payload
                : "Failed to connect") || "Failed to connect";
          throw new Error(message);
        }

        if (
          !payload ||
          typeof payload !== "object" ||
          Array.isArray(payload) ||
          typeof (payload as { authorizationUrl?: unknown })
            .authorizationUrl !== "string"
        ) {
          throw new Error("Missing authorization URL in response");
        }

        window.location.href = (
          payload as { authorizationUrl: string }
        ).authorizationUrl;
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to initiate connection",
        );
      } finally {
        setBusyServiceId(null);
      }
    },
    [token],
  );

  const handleDisconnect = useCallback(
    async (serviceId: string) => {
      if (!token) return;

      setBusyServiceId(serviceId);
      setError(null);

      try {
        await disconnectService(serviceId, token);
        setSuccessMessage(`Disconnected from ${serviceId} successfully`);
        await loadData();
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to disconnect service",
        );
      } finally {
        setBusyServiceId(null);
      }
    },
    [token, loadData],
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Service Connections</h1>
        <p className="text-muted-foreground">Loading services...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Service Connections</h1>
        <p className="text-muted-foreground">
          Connect your account to external services to use them in workflows.
        </p>
      </div>

      {successMessage && (
        <Alert className="mb-6 bg-green-50 text-green-900 border-green-200">
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            {successMessage}
          </div>
        </Alert>
      )}

      {error && (
        <Alert className="mb-6 bg-red-50 text-red-900 border-red-200">
          <div className="flex items-center gap-2">
            <span className="text-red-600">✗</span>
            {error}
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <Card key={service.id || service.name} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {service.name}
                    {service.isConnected && (
                      <Badge
                        variant="default"
                        className="bg-green-500 text-white"
                      >
                        Connected
                      </Badge>
                    )}
                  </CardTitle>
                  {service.connection && (
                    <CardDescription className="mt-1">
                      {service.connection.authType === "oauth2"
                        ? "OAuth2"
                        : service.connection.authType === "api_key"
                          ? "API Key"
                          : "No Auth"}
                    </CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {service.connection && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    {service.connection.scopes.length > 0 && (
                      <div>
                        <span className="font-medium">Scopes:</span>{" "}
                        {service.connection.scopes.join(", ")}
                      </div>
                    )}
                    {service.connection.isExpired && (
                      <div className="text-red-600 font-medium">
                        ⚠️ Token expired
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {service.actions.length > 0 && (
                    <div className="text-sm">
                      <span className="font-medium">Triggers:</span>{" "}
                      {service.actions.length}
                    </div>
                  )}
                  {service.reactions.length > 0 && (
                    <div className="text-sm">
                      <span className="font-medium">Actions:</span>{" "}
                      {service.reactions.length}
                    </div>
                  )}
                </div>

                {service.isConnected ? (
                  <div className="flex gap-2">
                    {service.connection?.isExpired && (
                      <Button
                        size="sm"
                        onClick={() =>
                          handleConnect(service.id || service.name)
                        }
                        disabled={
                          busyServiceId === (service.id || service.name)
                        }
                        className="flex-1"
                      >
                        Reconnect
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleDisconnect(service.id || service.name)
                      }
                      disabled={busyServiceId === (service.id || service.name)}
                      className="flex-1"
                    >
                      {busyServiceId === (service.id || service.name)
                        ? "Disconnecting..."
                        : "Disconnect"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleConnect(service.id || service.name)}
                    disabled={busyServiceId === (service.id || service.name)}
                    className="w-full"
                  >
                    Connect
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {services.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No services available
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Service Connections</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
