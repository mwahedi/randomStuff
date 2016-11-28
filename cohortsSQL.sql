SELECT
   p.customer_id
  ,p.id
  ,ms.state msState
  ,m.state
  ,m.price_gross
  ,m.delivery_frequency
  ,sh.cancelDate2
  ,EXTRACT(WEEK FROM i.shipping_date::date) as shipping
  ,EXTRACT(WEEK FROM sh.cancelDate2) - EXTRACT(WEEK FROM i.shipping_date::date) distanceToCancel
  ,EXTRACT(WEEK FROM i.shipping_date::date) - EXTRACT(WEEK FROM cohort.shipping) as distanceToIssue
  ,EXTRACT(WEEK FROM cohort.shipping) as cohort
  ,i.shipping_date::date
FROM purchase p
INNER JOIN membership as m ON m.customer_id = p.customer_id
INNER JOIN membership_subscription as ms ON ms.membership_id = m.id
INNER JOIN issue i on i.id = ms.issue_id
INNER JOIN (
  SELECT
     p.customer_id
    ,min(i.shipping_date::date) as shipping
  FROM purchase p
  INNER JOIN membership as m ON m.customer_id = p.customer_id
  INNER JOIN membership_subscription as ms ON ms.membership_id = m.id
  INNER JOIN issue i on i.id = ms.issue_id
  WHERE ms.state='done' AND i.shipping_date::date > '2016-06-11'
  GROUP BY 1
) cohort on cohort.customer_id=m.customer_id
left join
(
  select
    m.id
    ,min(sh.created_at::date) as cancelDate2
  from
    membership m
  inner join statemachine_history sh on m.id = sh.identifier
  where sh.schema_name = 'Membership' and (sh.final_state = 'cancelled' OR sh.final_state = 'pending_deletion')
  group by 1
) sh on sh.id = m.id
WHERE i.shipping_date::date > '2016-06-11' AND i.shipping_date < NOW()
AND ((EXTRACT(WEEK FROM sh.cancelDate2) - EXTRACT(WEEK FROM i.shipping_date::date) >=0
AND sh.cancelDate2>=i.shipping_date::date) OR sh.cancelDate2 IS NULL)
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12
ORDER BY 2,8
