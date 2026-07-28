import { IsIn, IsOptional } from 'class-validator';

export class ListNfceQueueDto {
  @IsOptional()
  @IsIn([
    'received',
    'extracting_reference',
    'reference_extracted',
    'pending_review',
    'in_review',
    'extraction_failed',
  ])
  status?:
    | 'received'
    | 'extracting_reference'
    | 'reference_extracted'
    | 'pending_review'
    | 'in_review'
    | 'extraction_failed';
}
