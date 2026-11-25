-- Validation de l'inventaire par le client (26/11/2026) : nouveaux statuts de la demande.
-- Fichier séparé : une valeur d'énumération ne peut pas être utilisée dans la transaction qui la crée.
alter type public.request_status add value if not exists 'awaiting_customer' after 'analyzing';
alter type public.request_status add value if not exists 'customer_validated' after 'awaiting_customer';
