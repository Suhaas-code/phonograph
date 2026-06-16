import { useState } from "react";
import { useExtensions } from "../api/hooks";
import { PageHeader, Spinner, Empty, ErrorText } from "../components/ui";
import ExtensionCard from "../components/extensions/ExtensionCard";
import InstallExtensionModal from "../components/extensions/InstallExtensionModal";

export default function SettingsPage() {
  const { data: extensions, isLoading, error } = useExtensions();
  const [installing, setInstalling] = useState(false);

  return (
    <div>
      <PageHeader
        title="Extensions"
        subtitle="External metadata services you've connected. They run independently and only receive the data you approve — never your audio."
        actions={
          <button className="btn-primary" onClick={() => setInstalling(true)}>
            Install extension
          </button>
        }
      />

      <ErrorText error={error} />

      {isLoading ? (
        <Spinner />
      ) : !extensions || extensions.length === 0 ? (
        <Empty>No extensions installed yet.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {extensions.map((ext) => (
            <ExtensionCard key={ext.id} ext={ext} />
          ))}
        </div>
      )}

      {installing && <InstallExtensionModal onClose={() => setInstalling(false)} />}
    </div>
  );
}
