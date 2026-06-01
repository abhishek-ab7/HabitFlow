-- High-throughput, multi-tenant RPC interface explicitly designed to resolve 409 loops safely at the database layer.
CREATE OR REPLACE FUNCTION public.reconcile_batch_habits_v2(
    payload_records JSONB
)
RETURNS TABLE (
    reconciled_id UUID,
    resolution_status TEXT
) AS $$
DECLARE
    item JSONB;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(payload_records) LOOP
        BEGIN
            INSERT INTO public.habits (
                id, user_id, name, icon, category, target_days, is_archived, order_index, is_quantitative, target_value, unit, generation_counter, updated_at
            ) VALUES (
                (item->>'id')::UUID,
                (item->>'user_id')::UUID,
                item->>'name',
                item->>'icon',
                item->>'category',
                (item->>'target_days')::INTEGER,
                (item->>'is_archived')::BOOLEAN,
                (item->>'order_index')::INTEGER,
                (item->>'is_quantitative')::BOOLEAN,
                (item->>'target_value')::NUMERIC,
                item->>'unit',
                (item->>'generation_counter')::BIGINT,
                NOW()
            )
            ON CONFLICT (id) DO UPDATE 
            SET 
                name = EXCLUDED.name,
                icon = EXCLUDED.icon,
                category = EXCLUDED.category,
                target_days = EXCLUDED.target_days,
                is_archived = EXCLUDED.is_archived,
                order_index = EXCLUDED.order_index,
                is_quantitative = EXCLUDED.is_quantitative,
                target_value = EXCLUDED.target_value,
                unit = EXCLUDED.unit,
                generation_counter = EXCLUDED.generation_counter,
                updated_at = NOW()
            WHERE EXCLUDED.generation_counter > habits.generation_counter;

            reconciled_id := (item->>'id')::UUID;
            resolution_status := 'RESOLVED_UPSERT';
            RETURN NEXT;

        EXCEPTION WHEN OTHERS THEN
            reconciled_id := (item->>'id')::UUID;
            resolution_status := 'CONCURRENCY_ABORT: ' || SQLERRM;
            RETURN NEXT;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
