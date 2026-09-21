import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBatch, useUpdateBatch } from '@/hooks/useBatches';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BatchForm } from '@/components/batches/BatchForm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BatchStatus } from '@/types';

export function BatchEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentHousehold } = useAuth();
  const { data: batch, isLoading } = useBatch(id);
  const updateMutation = useUpdateBatch();

  const handleSubmit = async (formData: {
    quantity: number;
    expires_at: string;
    status?: BatchStatus;
  }) => {
    if (!id) return;
    await updateMutation.mutateAsync({
      id,
      input: {
        quantity: formData.quantity,
        expires_at: formData.expires_at,
        status: formData.status,
      },
    });
    navigate('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950">
        <Header />
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-[#2d6a4f]" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950">
        <Header />
        <div className="flex-1 max-w-md mx-auto px-4 py-16 text-center">
          <p className="text-stone-600 dark:text-stone-400 mb-4">Lote não encontrado.</p>
          <Button onClick={() => navigate('/dashboard')}>Voltar para a despensa</Button>
        </div>
        <Footer />
      </div>
    );
  }

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
            <CardTitle>Editar Lote: {batch.product.name}</CardTitle>
            <CardDescription>
              Altere a quantidade restante, data de validade ou status do alimento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BatchForm
              initialBatch={batch}
              householdId={currentHousehold?.id}
              onSubmit={handleSubmit}
              onCancel={() => navigate('/dashboard')}
              isLoading={updateMutation.isPending}
            />
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
