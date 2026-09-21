import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCreateBatch } from '@/hooks/useBatches';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BatchForm } from '@/components/batches/BatchForm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function BatchNew() {
  const navigate = useNavigate();
  const { currentHousehold } = useAuth();
  const createMutation = useCreateBatch();

  const handleSubmit = async (formData: {
    household_id?: number;
    barcode?: string;
    name?: string;
    quantity: number;
    expires_at: string;
    photo?: File | null;
  }) => {
    await createMutation.mutateAsync({
      ...formData,
      household_id: currentHousehold?.id || formData.household_id,
    });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950">
      <Header />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="mb-4 text-stone-600 dark:text-stone-400"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Voltar para a despensa
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Adicionar Lote à Despensa</CardTitle>
            <CardDescription>
              Escaneie o código de barras com a câmera ou preencha as informações manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BatchForm
              householdId={currentHousehold?.id}
              onSubmit={handleSubmit}
              onCancel={() => navigate('/dashboard')}
              isLoading={createMutation.isPending}
            />
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
