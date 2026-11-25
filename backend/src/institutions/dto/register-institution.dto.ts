import { IsString, Length } from 'class-validator';

/** Public institution registration request — always lands PENDING; an admin
 *  must approve before the institution is visible or operational. Submitting
 *  never grants the submitter any role or membership. */
export class RegisterInstitutionDto {
  @IsString()
  @Length(3, 120)
  name!: string;

  @IsString()
  @Length(5, 240)
  publicAddress!: string;

  @IsString()
  @Length(5, 500)
  pickupInstructions!: string;
}
